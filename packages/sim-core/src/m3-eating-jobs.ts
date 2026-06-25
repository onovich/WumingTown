import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import { JOB_NONE, type JobCoreStore, type JobFailureReason } from "./job-core";
import type { ItemStackStore } from "./item-stack-store";
import { NEED_LANE_HUNGER, type NeedDirtySink, type NeedStore } from "./m3-needs";
import type { ReservationLedger, ReservationReason } from "./reservation-ledger";
import type { StorageLogisticsIndex } from "./storage-logistics-index";
import type { Tick } from "./time";
import type { M3FoodAvailabilityStore, M3FoodPortionView } from "./m3-food";

export const M3_EATING_JOB_KIND = 3;

const EATING_STEP_UNASSIGNED = 0;
const EATING_STEP_CREATED = 1;
const EATING_STEP_RESERVED = 2;
const EATING_STEP_PICKED_UP = 3;
const EATING_STEP_CONSUMED = 4;
const EATING_STEP_CANCELED = 5;
const EATING_STEP_FAILED = 6;
const NEED_DELTA_MAX = 0x7fff_ffff;

export type M3EatingStep =
  | "unassigned"
  | "created"
  | "reserved"
  | "picked_up"
  | "consumed"
  | "canceled"
  | "failed";

export type M3EatingReason =
  | "food.job_created"
  | "food.job_reserved"
  | "food.job_picked_up"
  | "food.consumed_integer_portion"
  | "food.job_canceled"
  | "food.job_failed"
  | "eating_job_id_out_of_range"
  | "eating_job_already_active"
  | "eating_job_not_active"
  | "eating_owner_invalid"
  | "eating_stack_invalid"
  | "eating_amount_invalid"
  | "eating_need_delta_invalid"
  | "eating_tick_invalid"
  | "eating_step_invalid"
  | "eating_item_mutation_failed"
  | "eating_need_mutation_failed"
  | "eating_job_core_failed"
  | "food.rejected_no_available_portion"
  | "food.rejected_permission"
  | "food.rejected_schedule"
  | "food.rejected_ability"
  | "food.rejected_stale_owner"
  | "reservation.item_quantity_conflict"
  | "reservation.interaction_spot_conflict"
  | "reservation.insufficient_amount"
  | "reservation.failed";

export type M3EatingMutationResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly version: number;
      readonly reason: M3EatingReason;
    }
  | { readonly ok: false; readonly reason: M3EatingReason };

export interface M3EatingJobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly sourceStackId: number;
  readonly storageSlotId: number;
  readonly foodDefId: number;
  readonly amount: number;
  readonly hungerRestore: number;
  readonly itemStoreVersion: number;
  readonly foodAvailabilityVersion: number;
  readonly mealWindowVersion: number;
  readonly abilityAllowed: boolean;
  readonly createdTick: Tick;
}

export interface M3EatingJobView extends M3EatingJobCreateInput {
  readonly step: M3EatingStep;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
  readonly consumedDefId: number;
  readonly consumedAmount: number;
  readonly terminalReason: M3EatingReason;
}

export interface M3EatingMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly pickedUpCount: number;
  readonly consumedCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly reservationAttemptCount: number;
  readonly reservationFailureCount: number;
  readonly consumedAmountTotal: number;
}

export class M3EatingJobDriverStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly ownerIndexes: Uint32Array;
  private readonly ownerGenerations: Uint32Array;
  private readonly sourceStackIds: Uint32Array;
  private readonly storageSlotIds: Uint32Array;
  private readonly foodDefIds: Uint32Array;
  private readonly amounts: Uint32Array;
  private readonly hungerRestores: Uint32Array;
  private readonly itemStoreVersions: Uint32Array;
  private readonly foodAvailabilityVersions: Uint32Array;
  private readonly mealWindowVersions: Uint32Array;
  private readonly abilityAllowedFlags: Uint8Array;
  private readonly createdTicks: Uint32Array;
  private readonly stepCodes: Uint8Array;
  private readonly carriedDefIds: Uint32Array;
  private readonly carriedAmounts: Uint32Array;
  private readonly consumedDefIds: Uint32Array;
  private readonly consumedAmounts: Uint32Array;
  private readonly terminalReasonCodes: Uint8Array;
  private activeCount = 0;
  private storeVersion = 0;
  private reservationAttempts = 0;
  private reservationFailures = 0;
  private consumedAmountTotal = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "m3 eating job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.ownerIndexes = new Uint32Array(capacity);
    this.ownerGenerations = new Uint32Array(capacity);
    this.sourceStackIds = new Uint32Array(capacity);
    this.storageSlotIds = new Uint32Array(capacity);
    this.foodDefIds = new Uint32Array(capacity);
    this.amounts = new Uint32Array(capacity);
    this.hungerRestores = new Uint32Array(capacity);
    this.itemStoreVersions = new Uint32Array(capacity);
    this.foodAvailabilityVersions = new Uint32Array(capacity);
    this.mealWindowVersions = new Uint32Array(capacity);
    this.abilityAllowedFlags = new Uint8Array(capacity);
    this.createdTicks = new Uint32Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.carriedDefIds = new Uint32Array(capacity);
    this.carriedAmounts = new Uint32Array(capacity);
    this.consumedDefIds = new Uint32Array(capacity);
    this.consumedAmounts = new Uint32Array(capacity);
    this.terminalReasonCodes = new Uint8Array(capacity);
    this.carriedDefIds.fill(JOB_NONE);
    this.consumedDefIds.fill(JOB_NONE);
  }

  createJob(
    input: M3EatingJobCreateInput,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const validation = this.validateCreate(input, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "eating_job_already_active" };
    }

    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: M3_EATING_JOB_KIND,
        targetId: input.sourceStackId,
        initialStep: "reserve",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: 0,
        createdTick: input.createdTick,
      },
      registry,
    );
    if (!created.ok) {
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.active[input.jobId] = 1;
    this.ownerIndexes[input.jobId] = input.owner.index;
    this.ownerGenerations[input.jobId] = input.owner.generation;
    this.sourceStackIds[input.jobId] = input.sourceStackId;
    this.storageSlotIds[input.jobId] = input.storageSlotId;
    this.foodDefIds[input.jobId] = input.foodDefId;
    this.amounts[input.jobId] = input.amount;
    this.hungerRestores[input.jobId] = input.hungerRestore;
    this.itemStoreVersions[input.jobId] = input.itemStoreVersion;
    this.foodAvailabilityVersions[input.jobId] = input.foodAvailabilityVersion;
    this.mealWindowVersions[input.jobId] = input.mealWindowVersion;
    this.abilityAllowedFlags[input.jobId] = input.abilityAllowed ? 1 : 0;
    this.createdTicks[input.jobId] = input.createdTick;
    this.stepCodes[input.jobId] = EATING_STEP_CREATED;
    this.carriedDefIds[input.jobId] = JOB_NONE;
    this.carriedAmounts[input.jobId] = 0;
    this.consumedDefIds[input.jobId] = JOB_NONE;
    this.consumedAmounts[input.jobId] = 0;
    this.terminalReasonCodes[input.jobId] = encodeEatingReason("food.job_created");
    this.activeCount += 1;
    return this.finish(input.jobId, "food.job_created");
  }

  reserveBeforePickup(
    jobId: number,
    tick: Tick,
    registry: EntityRegistry,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const context = this.readReservationContext(jobId, items, food, storage, ledger);
    if (!context.ok) {
      return context;
    }

    this.reservationAttempts += 1;
    const acquired = ledger.acquire(
      {
        owner: this.readOwner(jobId),
        jobId,
        createdTick: tick,
        leaseExpiryTick: tick + 300,
        claims: [
          {
            channel: "item_quantity",
            item: context.stack.entity,
            amount: context.amount,
            availableAmount: context.stack.quantity,
          },
          {
            channel: "interaction_spot",
            target: context.stack.entity,
            spotId: context.portion.interactionSpotId,
          },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      this.reservationFailures += 1;
      return { ok: false, reason: mapReservationReason(acquired.reason) };
    }

    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      const released = ledger.releaseClaims(acquired.claimIds);
      if (!released.ok) {
        return { ok: false, reason: mapReservationReason(released.reason) };
      }
      food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
      storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.stepCodes[jobId] = EATING_STEP_RESERVED;
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return this.finish(jobId, "food.job_reserved");
  }

  pickup(
    jobId: number,
    tick: Tick,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const validation = this.validateStep(jobId, EATING_STEP_RESERVED);
    if (!validation.ok) {
      return validation;
    }

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "eating_tick_invalid" };
    }

    const amount = this.amounts[jobId] ?? 0;
    const defId = this.foodDefIds[jobId] ?? 0;
    const removed = items.removeQuantity(this.sourceStackIds[jobId] ?? 0, amount, defId);
    if (!removed.ok) {
      return { ok: false, reason: "eating_item_mutation_failed" };
    }

    const carried = jobCore.setCarriedState(jobId, defId, amount);
    if (!carried.ok) {
      rollbackItemAdd(items, this.sourceStackIds[jobId] ?? 0, amount, defId);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      rollbackItemAdd(items, this.sourceStackIds[jobId] ?? 0, amount, defId);
      rollbackCarriedClear(jobCore, jobId);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.carriedDefIds[jobId] = defId;
    this.carriedAmounts[jobId] = amount;
    this.stepCodes[jobId] = EATING_STEP_PICKED_UP;
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return this.finish(jobId, "food.job_picked_up");
  }

  consume(
    jobId: number,
    tick: Tick,
    needs: NeedStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    dirtySink?: NeedDirtySink,
  ): M3EatingMutationResult {
    const validation = this.validateStep(jobId, EATING_STEP_PICKED_UP);
    if (!validation.ok) {
      return validation;
    }

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "eating_tick_invalid" };
    }

    const owner = this.readOwner(jobId);
    if (!needs.isActorActive(owner.index)) {
      return { ok: false, reason: "eating_need_mutation_failed" };
    }

    const hungerRestore = this.hungerRestores[jobId] ?? 0;
    if (!isNonNegativeNeedDelta(hungerRestore)) {
      return { ok: false, reason: "eating_need_delta_invalid" };
    }

    const previousHunger = needs.readLaneValue(owner.index, NEED_LANE_HUNGER);
    const needChanged = needs.applyLaneDelta(
      {
        actorId: owner.index,
        lane: NEED_LANE_HUNGER,
        tick,
        reason: "need.external_delta",
        sourceSystemId: M3_EATING_JOB_KIND,
        sourceEventId: jobId,
      },
      hungerRestore,
    );
    if (!needChanged.ok) {
      return { ok: false, reason: "eating_need_mutation_failed" };
    }

    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      rollbackNeedValue(needs, owner.index, previousHunger, tick, jobId);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    if (needChanged.changed) {
      dirtySink?.markDirty(needChanged.actorId, needChanged.lane);
    }

    const amount = this.carriedAmounts[jobId] ?? 0;
    this.consumedDefIds[jobId] = this.carriedDefIds[jobId] ?? JOB_NONE;
    this.consumedAmounts[jobId] = amount;
    this.consumedAmountTotal += amount;
    this.clearCarried(jobId);
    this.stepCodes[jobId] = EATING_STEP_CONSUMED;
    return this.finish(jobId, "food.consumed_integer_portion");
  }

  cancel(
    jobId: number,
    tick: Tick,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    return this.finishNonConsumedTerminal(
      jobId,
      tick,
      "food.job_canceled",
      "cancelled",
      items,
      food,
      storage,
      ledger,
      jobCore,
    );
  }

  fail(
    jobId: number,
    tick: Tick,
    reason: JobFailureReason,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    return this.finishNonConsumedTerminal(
      jobId,
      tick,
      "food.job_failed",
      reason,
      items,
      food,
      storage,
      ledger,
      jobCore,
    );
  }

  readJob(jobId: number): M3EatingJobView | undefined {
    if (!this.isActiveJob(jobId)) {
      return undefined;
    }

    return {
      jobId,
      owner: this.readOwner(jobId),
      sourceStackId: this.sourceStackIds[jobId] ?? 0,
      storageSlotId: this.storageSlotIds[jobId] ?? 0,
      foodDefId: this.foodDefIds[jobId] ?? 0,
      amount: this.amounts[jobId] ?? 0,
      hungerRestore: this.hungerRestores[jobId] ?? 0,
      itemStoreVersion: this.itemStoreVersions[jobId] ?? 0,
      foodAvailabilityVersion: this.foodAvailabilityVersions[jobId] ?? 0,
      mealWindowVersion: this.mealWindowVersions[jobId] ?? 0,
      abilityAllowed: (this.abilityAllowedFlags[jobId] ?? 0) === 1,
      createdTick: this.createdTicks[jobId] ?? 0,
      step: decodeStep(this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED),
      carriedDefId: this.carriedDefIds[jobId] ?? JOB_NONE,
      carriedAmount: this.carriedAmounts[jobId] ?? 0,
      consumedDefId: this.consumedDefIds[jobId] ?? JOB_NONE,
      consumedAmount: this.consumedAmounts[jobId] ?? 0,
      terminalReason: decodeEatingReason(this.terminalReasonCodes[jobId] ?? 0),
    };
  }

  createMetrics(): M3EatingMetrics {
    let reservedCount = 0;
    let pickedUpCount = 0;
    let consumedCount = 0;
    let canceledCount = 0;
    let failedCount = 0;

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if ((this.active[jobId] ?? 0) === 1) {
        const step = this.stepCodes[jobId] ?? 0;
        reservedCount += step === EATING_STEP_RESERVED ? 1 : 0;
        pickedUpCount += step === EATING_STEP_PICKED_UP ? 1 : 0;
        consumedCount += step === EATING_STEP_CONSUMED ? 1 : 0;
        canceledCount += step === EATING_STEP_CANCELED ? 1 : 0;
        failedCount += step === EATING_STEP_FAILED ? 1 : 0;
      }
    }

    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount,
      pickedUpCount,
      consumedCount,
      canceledCount,
      failedCount,
      reservationAttemptCount: this.reservationAttempts,
      reservationFailureCount: this.reservationFailures,
      consumedAmountTotal: this.consumedAmountTotal,
    };
  }

  private readReservationContext(
    jobId: number,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
  ):
    | {
        readonly ok: true;
        readonly amount: number;
        readonly portion: M3FoodPortionView;
        readonly stack: NonNullable<ReturnType<ItemStackStore["readStack"]>>;
      }
    | { readonly ok: false; readonly reason: M3EatingReason } {
    const validation = this.validateStep(jobId, EATING_STEP_CREATED);
    if (!validation.ok) {
      return validation;
    }
    if ((this.abilityAllowedFlags[jobId] ?? 0) !== 1) {
      return { ok: false, reason: "food.rejected_ability" };
    }

    const portion = food.readPortion(this.sourceStackIds[jobId] ?? 0);
    if (portion === undefined || portion.availableAmount < (this.amounts[jobId] ?? 0)) {
      return { ok: false, reason: "food.rejected_no_available_portion" };
    }
    if (!portion.permissionAllowed || !portion.safe) {
      return { ok: false, reason: "food.rejected_permission" };
    }
    if (!portion.scheduleAllowed) {
      return { ok: false, reason: "food.rejected_schedule" };
    }
    if (
      portion.itemStoreVersion !== (this.itemStoreVersions[jobId] ?? 0) ||
      portion.foodAvailabilityVersion !== (this.foodAvailabilityVersions[jobId] ?? 0) ||
      portion.mealWindowVersion !== (this.mealWindowVersions[jobId] ?? 0)
    ) {
      return { ok: false, reason: "food.rejected_stale_owner" };
    }
    if (storage.readSlot(this.storageSlotIds[jobId] ?? 0) === undefined) {
      return { ok: false, reason: "food.rejected_stale_owner" };
    }

    const stack = items.readStack(this.sourceStackIds[jobId] ?? 0, ledger);
    if (stack === undefined || stack.availableQuantity < (this.amounts[jobId] ?? 0)) {
      return { ok: false, reason: "food.rejected_no_available_portion" };
    }

    return { ok: true, amount: this.amounts[jobId] ?? 0, portion, stack };
  }

  private finishNonConsumedTerminal(
    jobId: number,
    tick: Tick,
    terminalReason: M3EatingReason,
    jobReason: JobFailureReason,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if (this.isTerminalStep(jobId)) {
      return { ok: false, reason: "eating_step_invalid" };
    }

    const returned = this.returnCarried(jobId, items, food, storage);
    if (!returned.ok) {
      return returned;
    }

    const terminal =
      terminalReason === "food.job_canceled"
        ? jobCore.cancelJob(jobId, tick, ledger)
        : jobCore.failJob(jobId, tick, jobReason, ledger);
    if (!terminal.ok) {
      this.rollbackReturned(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        food,
        storage,
      );
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.clearCarried(jobId);
    this.stepCodes[jobId] =
      terminalReason === "food.job_canceled" ? EATING_STEP_CANCELED : EATING_STEP_FAILED;
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return this.finish(jobId, terminalReason);
  }

  private returnCarried(
    jobId: number,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
  ):
    | { readonly ok: true; readonly returnedAmount: number; readonly returnedDefId: number }
    | { readonly ok: false; readonly reason: M3EatingReason } {
    if ((this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED) !== EATING_STEP_PICKED_UP) {
      return { ok: true, returnedAmount: 0, returnedDefId: JOB_NONE };
    }

    const amount = this.carriedAmounts[jobId] ?? 0;
    const defId = this.carriedDefIds[jobId] ?? JOB_NONE;
    const returned = items.addQuantity(this.sourceStackIds[jobId] ?? 0, amount, defId);
    if (!returned.ok) {
      return { ok: false, reason: "eating_item_mutation_failed" };
    }
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return { ok: true, returnedAmount: amount, returnedDefId: defId };
  }

  private rollbackReturned(
    jobId: number,
    amount: number,
    defId: number,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
  ): void {
    if (amount === 0) {
      return;
    }
    const removed = items.removeQuantity(this.sourceStackIds[jobId] ?? 0, amount, defId);
    if (!removed.ok) {
      throw new Error(`failed to rollback returned eating quantity: ${removed.reason}`);
    }
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
  }

  private validateCreate(
    input: M3EatingJobCreateInput,
    registry: EntityRegistry,
  ): M3EatingMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "eating_job_id_out_of_range" };
    }
    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "eating_owner_invalid" };
    }
    if (!isSafeUint32(input.sourceStackId) || !isSafeUint32(input.storageSlotId)) {
      return { ok: false, reason: "eating_stack_invalid" };
    }
    if (!isPositiveUint32(input.amount)) {
      return { ok: false, reason: "eating_amount_invalid" };
    }
    if (!isNonNegativeNeedDelta(input.hungerRestore)) {
      return { ok: false, reason: "eating_need_delta_invalid" };
    }
    if (!input.abilityAllowed) {
      return { ok: false, reason: "food.rejected_ability" };
    }
    if (!isSafeUint32(input.createdTick)) {
      return { ok: false, reason: "eating_tick_invalid" };
    }
    return { ok: true, jobId: input.jobId, version: this.storeVersion, reason: "food.job_created" };
  }

  private validateStep(jobId: number, expectedStep: number): M3EatingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if ((this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED) !== expectedStep) {
      return { ok: false, reason: "eating_step_invalid" };
    }
    return { ok: true, jobId, version: this.storeVersion, reason: "food.job_created" };
  }

  private validateActive(jobId: number): M3EatingMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "eating_job_not_active" };
    }
    return { ok: true, jobId, version: this.storeVersion, reason: "food.job_created" };
  }

  private isActiveJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
  }

  private isTerminalStep(jobId: number): boolean {
    const step = this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED;
    return (
      step === EATING_STEP_CONSUMED || step === EATING_STEP_CANCELED || step === EATING_STEP_FAILED
    );
  }

  private readOwner(jobId: number): EntityId {
    return {
      index: this.ownerIndexes[jobId] ?? 0,
      generation: this.ownerGenerations[jobId] ?? 0,
    };
  }

  private clearCarried(jobId: number): void {
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
  }

  private finish(jobId: number, reason: M3EatingReason): M3EatingMutationResult {
    this.terminalReasonCodes[jobId] = encodeEatingReason(reason);
    this.storeVersion += 1;
    return { ok: true, jobId, version: this.storeVersion, reason };
  }
}

export function createM3EatingJobDriverStore(capacity: number): M3EatingJobDriverStore {
  return new M3EatingJobDriverStore(capacity);
}

export function calculateM3FoodConservationTotal(
  items: ItemStackStore,
  eating: M3EatingJobDriverStore,
  foodDefId: number,
  stackCount: number,
): number {
  let total = 0;

  for (let stackId = 0; stackId < stackCount; stackId += 1) {
    const stack = items.readStack(stackId);
    if (stack?.defId === foodDefId) {
      total += stack.quantity;
    }
  }

  for (let jobId = 0; jobId < eating.capacity; jobId += 1) {
    const job = eating.readJob(jobId);
    if (job?.carriedDefId === foodDefId) {
      total += job.carriedAmount;
    }
    if (job?.consumedDefId === foodDefId) {
      total += job.consumedAmount;
    }
  }

  return total;
}

function mapReservationReason(reason: ReservationReason): M3EatingReason {
  if (reason === "reservation_item_quantity_conflict") {
    return "reservation.item_quantity_conflict";
  }
  if (reason === "reservation_interaction_conflict") {
    return "reservation.interaction_spot_conflict";
  }
  if (reason === "reservation_insufficient_amount") {
    return "reservation.insufficient_amount";
  }
  return "reservation.failed";
}

function rollbackItemAdd(
  items: ItemStackStore,
  stackId: number,
  amount: number,
  defId: number,
): void {
  const restored = items.addQuantity(stackId, amount, defId);
  if (!restored.ok) {
    throw new Error(`failed to rollback eating pickup quantity: ${restored.reason}`);
  }
}

function rollbackCarriedClear(jobCore: JobCoreStore, jobId: number): void {
  const cleared = jobCore.setCarriedState(jobId, JOB_NONE, 0);
  if (!cleared.ok) {
    throw new Error(`failed to rollback eating carried state: ${cleared.reason}`);
  }
}

function rollbackNeedValue(
  needs: NeedStore,
  actorId: number,
  previousHunger: number,
  tick: Tick,
  jobId: number,
): void {
  const restored = needs.setLane(
    {
      actorId,
      lane: NEED_LANE_HUNGER,
      tick,
      reason: "need.external_delta",
      sourceSystemId: M3_EATING_JOB_KIND,
      sourceEventId: jobId,
    },
    previousHunger,
  );
  if (!restored.ok) {
    throw new Error(`failed to rollback eating hunger delta: ${restored.reason}`);
  }
}

function encodeEatingReason(reason: M3EatingReason): number {
  if (reason === "food.job_reserved") {
    return 1;
  }
  if (reason === "food.job_picked_up") {
    return 2;
  }
  if (reason === "food.consumed_integer_portion") {
    return 3;
  }
  if (reason === "food.job_canceled") {
    return 4;
  }
  if (reason === "food.job_failed") {
    return 5;
  }
  return 0;
}

function decodeEatingReason(code: number): M3EatingReason {
  if (code === 1) {
    return "food.job_reserved";
  }
  if (code === 2) {
    return "food.job_picked_up";
  }
  if (code === 3) {
    return "food.consumed_integer_portion";
  }
  if (code === 4) {
    return "food.job_canceled";
  }
  if (code === 5) {
    return "food.job_failed";
  }
  return "food.job_created";
}

function decodeStep(code: number): M3EatingStep {
  if (code === EATING_STEP_CREATED) {
    return "created";
  }
  if (code === EATING_STEP_RESERVED) {
    return "reserved";
  }
  if (code === EATING_STEP_PICKED_UP) {
    return "picked_up";
  }
  if (code === EATING_STEP_CONSUMED) {
    return "consumed";
  }
  if (code === EATING_STEP_CANCELED) {
    return "canceled";
  }
  if (code === EATING_STEP_FAILED) {
    return "failed";
  }
  return "unassigned";
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isNonNegativeNeedDelta(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= NEED_DELTA_MAX;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}
