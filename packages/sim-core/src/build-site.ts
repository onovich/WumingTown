import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { ItemStackStore, ItemStackView } from "./item-stack-store";
import type { JobCoreStore } from "./job-core";
import type { LocationStore } from "./location-store";
import type { MapGrid } from "./map-grid";
import type { ReservationLedger, ReservationReason } from "./reservation-ledger";
import { isSafeTick, type Tick } from "./time";
import type { WorkOfferIndex, WorkOfferInput } from "./work-offers";

export const BUILD_SITE_DELIVERY_JOB_KIND = 2;
export const BUILD_SITE_CONSTRUCTION_JOB_KIND = 3;
export const BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL = 1;

const SITE_INACTIVE = 0;
const SITE_ACTIVE = 1;
const SITE_COMPLETED = 2;

const JOB_INACTIVE = 0;
const JOB_CREATED = 1;
const JOB_RESERVED = 2;
const JOB_PICKED_UP = 3;
const JOB_DELIVERED = 4;
const JOB_BUILDING = 5;
const JOB_BUILT = 6;
const JOB_CANCELED = 7;

const JOB_MODE_NONE = 0;
const JOB_MODE_DELIVERY = 1;
const JOB_MODE_BUILD = 2;

export type BuildSiteJobStep =
  | "inactive"
  | "created"
  | "reserved"
  | "picked_up"
  | "delivered"
  | "building"
  | "built"
  | "canceled";

export type BuildSiteReason =
  | "site.id_out_of_range"
  | "site.already_active"
  | "site.not_active"
  | "site.entity_invalid"
  | "site.job_id_out_of_range"
  | "site.job_already_active"
  | "site.job_not_active"
  | "site.job_step_invalid"
  | "site.job_mode_invalid"
  | "site.tick_invalid"
  | "site.progress_invalid"
  | "target.invalid_state"
  | "material.def_not_required"
  | "material.insufficient_required_amount"
  | "material.capacity_exceeded"
  | "reservation.destination_capacity_conflict"
  | "reservation.interaction_conflict"
  | "reservation.source_quantity_conflict"
  | "reservation.failed"
  | "path.no_route_to_source"
  | "path.no_route_to_destination"
  | "site.blocked"
  | "item_stack.failed"
  | "job_core.failed"
  | "work_offer.failed"
  | "map.location_failed"
  | "entity.capacity_exhausted";

export type BuildSiteMutationResult =
  | {
      readonly ok: true;
      readonly siteId: number;
      readonly version: number;
    }
  | {
      readonly ok: false;
      readonly reason: BuildSiteReason;
    };

export type BuildSiteJobResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly siteId: number;
      readonly version: number;
    }
  | {
      readonly ok: false;
      readonly reason: BuildSiteReason;
    };

export type BuildSiteCompletionResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly siteId: number;
      readonly building: EntityId;
      readonly version: number;
    }
  | {
      readonly ok: false;
      readonly reason: BuildSiteReason;
    };

export interface BuildSiteCreateInput {
  readonly siteId: number;
  readonly site: EntityId;
  readonly blueprintDefId: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly interactionCellA: number;
  readonly interactionCellB: number;
  readonly requiredDefIds: readonly [number, number];
  readonly requiredAmounts: readonly [number, number];
  readonly buildRequiredTicks: number;
  readonly materialOfferIds: readonly [number, number];
  readonly buildOfferId: number;
  readonly deliverWorkType: number;
  readonly buildWorkType: number;
  readonly regionId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
}

export interface BuildSiteDeliveryJobInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly siteId: number;
  readonly sourceStackId: number;
  readonly defId: number;
  readonly amount: number;
  readonly createdTick: Tick;
}

export interface BuildSiteReservationInput {
  readonly jobId: number;
  readonly tick: Tick;
  readonly leaseExpiryTick: Tick;
  readonly sourceInteractionSpotId: number;
  readonly destinationInteractionSpotId: number;
}

export interface BuildSiteBuildJobInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly siteId: number;
  readonly createdTick: Tick;
}

export interface BuildSiteBuildReservationInput {
  readonly jobId: number;
  readonly tick: Tick;
  readonly leaseExpiryTick: Tick;
  readonly interactionSpotId: number;
}

export interface BuildSiteView {
  readonly siteId: number;
  readonly site: EntityId;
  readonly active: boolean;
  readonly completed: boolean;
  readonly blueprintDefId: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly anchorCellIndex: number;
  readonly interactionCellA: number;
  readonly interactionCellB: number;
  readonly requiredDefA: number;
  readonly requiredDefB: number;
  readonly requiredAmountA: number;
  readonly requiredAmountB: number;
  readonly deliveredAmountA: number;
  readonly deliveredAmountB: number;
  readonly reservedCapacityA: number;
  readonly reservedCapacityB: number;
  readonly remainingDemandA: number;
  readonly remainingDemandB: number;
  readonly buildProgressTicks: number;
  readonly buildRequiredTicks: number;
  readonly buildingEntityIndex: number;
  readonly buildingEntityGeneration: number;
  readonly lanternState: number;
}

export interface BuildSiteJobView {
  readonly jobId: number;
  readonly siteId: number;
  readonly mode: "none" | "delivery" | "build";
  readonly step: BuildSiteJobStep;
  readonly owner: EntityId;
  readonly sourceStackId: number;
  readonly defId: number;
  readonly amount: number;
}

export interface BuildSiteMetrics {
  readonly version: number;
  readonly activeSiteCount: number;
  readonly completedSiteCount: number;
  readonly activeJobCount: number;
  readonly deliveredTotal: number;
  readonly buildProgressTotal: number;
  readonly completedBuildingCount: number;
  readonly demandOfferCount: number;
  readonly buildOfferCount: number;
}

export class BuildSiteStore {
  readonly siteCapacity: number;
  readonly jobCapacity: number;

  private readonly siteState: Uint8Array;
  private readonly siteEntityIndex: Uint32Array;
  private readonly siteEntityGeneration: Uint32Array;
  private readonly blueprintDefId: Uint32Array;
  private readonly anchorX: Uint32Array;
  private readonly anchorY: Uint32Array;
  private readonly anchorCellIndex: Uint32Array;
  private readonly interactionCellA: Uint32Array;
  private readonly interactionCellB: Uint32Array;
  private readonly requiredDefA: Uint32Array;
  private readonly requiredDefB: Uint32Array;
  private readonly requiredAmountA: Uint32Array;
  private readonly requiredAmountB: Uint32Array;
  private readonly deliveredAmountA: Uint32Array;
  private readonly deliveredAmountB: Uint32Array;
  private readonly buildProgressTicks: Uint32Array;
  private readonly buildRequiredTicks: Uint32Array;
  private readonly materialOfferA: Uint32Array;
  private readonly materialOfferB: Uint32Array;
  private readonly buildOffer: Uint32Array;
  private readonly deliverWorkType: Uint32Array;
  private readonly buildWorkType: Uint32Array;
  private readonly regionId: Uint32Array;
  private readonly urgencyBucket: Uint32Array;
  private readonly permissionId: Uint32Array;
  private readonly offerStateA: Uint8Array;
  private readonly offerStateB: Uint8Array;
  private readonly offerStateBuild: Uint8Array;
  private readonly buildingEntityIndex: Uint32Array;
  private readonly buildingEntityGeneration: Uint32Array;
  private readonly lanternState: Uint32Array;
  private readonly jobActive: Uint8Array;
  private readonly jobMode: Uint8Array;
  private readonly jobStep: Uint8Array;
  private readonly jobSiteId: Uint32Array;
  private readonly jobOwnerIndex: Uint32Array;
  private readonly jobOwnerGeneration: Uint32Array;
  private readonly jobSourceStackId: Uint32Array;
  private readonly jobDefId: Uint32Array;
  private readonly jobAmount: Uint32Array;
  private storeVersion = 0;
  private activeSiteCount = 0;
  private completedSiteCount = 0;
  private activeJobCount = 0;
  private completedBuildingCount = 0;

  constructor(siteCapacity: number, jobCapacity: number) {
    assertValidCapacity(siteCapacity, "build site capacity");
    assertValidCapacity(jobCapacity, "build site job capacity");
    this.siteCapacity = siteCapacity;
    this.jobCapacity = jobCapacity;
    this.siteState = new Uint8Array(siteCapacity);
    this.siteEntityIndex = new Uint32Array(siteCapacity);
    this.siteEntityGeneration = new Uint32Array(siteCapacity);
    this.blueprintDefId = new Uint32Array(siteCapacity);
    this.anchorX = new Uint32Array(siteCapacity);
    this.anchorY = new Uint32Array(siteCapacity);
    this.anchorCellIndex = new Uint32Array(siteCapacity);
    this.interactionCellA = new Uint32Array(siteCapacity);
    this.interactionCellB = new Uint32Array(siteCapacity);
    this.requiredDefA = new Uint32Array(siteCapacity);
    this.requiredDefB = new Uint32Array(siteCapacity);
    this.requiredAmountA = new Uint32Array(siteCapacity);
    this.requiredAmountB = new Uint32Array(siteCapacity);
    this.deliveredAmountA = new Uint32Array(siteCapacity);
    this.deliveredAmountB = new Uint32Array(siteCapacity);
    this.buildProgressTicks = new Uint32Array(siteCapacity);
    this.buildRequiredTicks = new Uint32Array(siteCapacity);
    this.materialOfferA = new Uint32Array(siteCapacity);
    this.materialOfferB = new Uint32Array(siteCapacity);
    this.buildOffer = new Uint32Array(siteCapacity);
    this.deliverWorkType = new Uint32Array(siteCapacity);
    this.buildWorkType = new Uint32Array(siteCapacity);
    this.regionId = new Uint32Array(siteCapacity);
    this.urgencyBucket = new Uint32Array(siteCapacity);
    this.permissionId = new Uint32Array(siteCapacity);
    this.offerStateA = new Uint8Array(siteCapacity);
    this.offerStateB = new Uint8Array(siteCapacity);
    this.offerStateBuild = new Uint8Array(siteCapacity);
    this.buildingEntityIndex = new Uint32Array(siteCapacity);
    this.buildingEntityGeneration = new Uint32Array(siteCapacity);
    this.lanternState = new Uint32Array(siteCapacity);
    this.jobActive = new Uint8Array(jobCapacity);
    this.jobMode = new Uint8Array(jobCapacity);
    this.jobStep = new Uint8Array(jobCapacity);
    this.jobSiteId = new Uint32Array(jobCapacity);
    this.jobOwnerIndex = new Uint32Array(jobCapacity);
    this.jobOwnerGeneration = new Uint32Array(jobCapacity);
    this.jobSourceStackId = new Uint32Array(jobCapacity);
    this.jobDefId = new Uint32Array(jobCapacity);
    this.jobAmount = new Uint32Array(jobCapacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  createSite(input: BuildSiteCreateInput, registry?: EntityRegistry): BuildSiteMutationResult {
    const validation = this.validateCreateSite(input, registry);
    if (!validation.ok) {
      return validation;
    }

    this.siteState[input.siteId] = SITE_ACTIVE;
    this.siteEntityIndex[input.siteId] = input.site.index;
    this.siteEntityGeneration[input.siteId] = input.site.generation;
    this.blueprintDefId[input.siteId] = input.blueprintDefId;
    this.anchorX[input.siteId] = input.anchorX;
    this.anchorY[input.siteId] = input.anchorY;
    this.anchorCellIndex[input.siteId] = input.anchorY * 16 + input.anchorX;
    this.interactionCellA[input.siteId] = input.interactionCellA;
    this.interactionCellB[input.siteId] = input.interactionCellB;
    this.requiredDefA[input.siteId] = input.requiredDefIds[0];
    this.requiredDefB[input.siteId] = input.requiredDefIds[1];
    this.requiredAmountA[input.siteId] = input.requiredAmounts[0];
    this.requiredAmountB[input.siteId] = input.requiredAmounts[1];
    this.materialOfferA[input.siteId] = input.materialOfferIds[0];
    this.materialOfferB[input.siteId] = input.materialOfferIds[1];
    this.buildOffer[input.siteId] = input.buildOfferId;
    this.deliverWorkType[input.siteId] = input.deliverWorkType;
    this.buildWorkType[input.siteId] = input.buildWorkType;
    this.regionId[input.siteId] = input.regionId;
    this.urgencyBucket[input.siteId] = input.urgencyBucket;
    this.permissionId[input.siteId] = input.permissionId;
    this.buildRequiredTicks[input.siteId] = input.buildRequiredTicks;
    this.activeSiteCount += 1;
    return this.finishSite(input.siteId);
  }

  createDeliveryJob(
    input: BuildSiteDeliveryJobInput,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const validation = this.validateDeliveryCreate(input, registry);
    if (!validation.ok) {
      return validation;
    }

    const siteEntity = this.readSiteEntity(input.siteId);
    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: BUILD_SITE_DELIVERY_JOB_KIND,
        targetId: siteEntity.index,
        initialStep: "reserve",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: input.createdTick,
      },
      registry,
    );

    if (!created.ok) {
      return { ok: false, reason: "job_core.failed" };
    }

    this.writeJob(input, JOB_MODE_DELIVERY, JOB_CREATED);
    return this.finishJob(input.jobId, input.siteId);
  }

  reserveDelivery(
    input: BuildSiteReservationInput,
    registry: EntityRegistry,
    items: ItemStackStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const ready = this.validateDeliveryReady(input.jobId, input.tick, items, ledger);
    if (!ready.ok) {
      return ready;
    }

    const siteId = this.jobSiteId[input.jobId] ?? 0;
    const acquired = ledger.acquire(
      {
        owner: this.readJobOwner(input.jobId),
        jobId: input.jobId,
        createdTick: input.tick,
        leaseExpiryTick: input.leaseExpiryTick,
        claims: [
          {
            channel: "item_quantity",
            item: ready.stack.entity,
            amount: this.jobAmount[input.jobId] ?? 0,
            availableAmount: ready.stack.availableQuantity,
          },
          {
            channel: "capacity",
            target: this.readSiteEntity(siteId),
            capacityId: this.jobDefId[input.jobId] ?? 0,
            amount: this.jobAmount[input.jobId] ?? 0,
            capacity: ready.capacity,
          },
          {
            channel: "interaction_spot",
            target: ready.stack.entity,
            spotId: input.sourceInteractionSpotId,
          },
          {
            channel: "interaction_spot",
            target: this.readSiteEntity(siteId),
            spotId: input.destinationInteractionSpotId,
          },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      return { ok: false, reason: mapReservationReason(acquired.reason) };
    }

    const entered = jobCore.enterStep(input.jobId, "path_to_source", input.tick);
    if (!entered.ok) {
      ledger.releaseClaims(acquired.claimIds);
      return { ok: false, reason: "job_core.failed" };
    }

    this.jobStep[input.jobId] = JOB_RESERVED;
    return this.finishJob(input.jobId, siteId);
  }

  pickupDelivery(
    jobId: number,
    tick: Tick,
    items: ItemStackStore,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const ready = this.validateJobStep(jobId, JOB_MODE_DELIVERY, JOB_RESERVED, tick);
    if (!ready.ok) {
      return ready;
    }

    const defId = this.jobDefId[jobId] ?? 0;
    const amount = this.jobAmount[jobId] ?? 0;
    const sourceStackId = this.jobSourceStackId[jobId] ?? 0;
    const removed = items.removeQuantity(sourceStackId, amount, defId);

    if (!removed.ok) {
      return { ok: false, reason: "item_stack.failed" };
    }

    const carried = jobCore.setCarriedState(jobId, defId, amount);
    if (!carried.ok) {
      this.restoreSourceQuantity(items, sourceStackId, amount, defId);
      return { ok: false, reason: "job_core.failed" };
    }

    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      this.restoreSourceQuantity(items, sourceStackId, amount, defId);
      jobCore.setCarriedState(jobId, 0xffff_ffff, 0);
      return { ok: false, reason: "job_core.failed" };
    }

    this.jobStep[jobId] = JOB_PICKED_UP;
    return this.finishJob(jobId, this.jobSiteId[jobId] ?? 0);
  }

  deliverToSite(
    jobId: number,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const ready = this.validateDeliveryCommit(jobId, tick, jobCore);
    if (!ready.ok) {
      return ready;
    }

    this.addDeliveredUnchecked(ready.siteId, ready.slot, ready.amount);
    const completed = jobCore.completeJob(jobId, tick, ledger);

    if (!completed.ok) {
      this.removeDeliveredUnchecked(ready.siteId, ready.slot, ready.amount);
      return { ok: false, reason: "job_core.failed" };
    }

    this.jobStep[jobId] = JOB_DELIVERED;
    this.jobDefId[jobId] = 0xffff_ffff;
    this.jobAmount[jobId] = 0;
    return this.finishJob(jobId, ready.siteId);
  }

  createBuildJob(
    input: BuildSiteBuildJobInput,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const validation = this.validateBuildCreate(input);
    if (!validation.ok) {
      return validation;
    }

    const siteEntity = this.readSiteEntity(input.siteId);
    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: BUILD_SITE_CONSTRUCTION_JOB_KIND,
        targetId: siteEntity.index,
        initialStep: "reserve",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: this.buildRequiredTicks[input.siteId] ?? 0,
        createdTick: input.createdTick,
      },
      registry,
    );

    if (!created.ok) {
      return { ok: false, reason: "job_core.failed" };
    }

    this.writeBuildJob(input, JOB_CREATED);
    return this.finishJob(input.jobId, input.siteId);
  }

  reserveBuildJob(
    input: BuildSiteBuildReservationInput,
    registry: EntityRegistry,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const ready = this.validateJobStep(input.jobId, JOB_MODE_BUILD, JOB_CREATED, input.tick);
    if (!ready.ok) {
      return ready;
    }

    const siteId = this.jobSiteId[input.jobId] ?? 0;
    const site = this.readSiteEntity(siteId);
    const acquired = ledger.acquire(
      {
        owner: this.readJobOwner(input.jobId),
        jobId: input.jobId,
        createdTick: input.tick,
        leaseExpiryTick: input.leaseExpiryTick,
        claims: [
          { channel: "entity", target: site },
          { channel: "interaction_spot", target: site, spotId: input.interactionSpotId },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      return { ok: false, reason: mapReservationReason(acquired.reason) };
    }

    const entered = jobCore.enterStep(input.jobId, "interact", input.tick);
    if (!entered.ok) {
      ledger.releaseClaims(acquired.claimIds);
      return { ok: false, reason: "job_core.failed" };
    }

    this.jobStep[input.jobId] = JOB_BUILDING;
    return this.finishJob(input.jobId, siteId);
  }

  tickBuild(
    jobId: number,
    tick: Tick,
    workTicks: number,
    jobCore: JobCoreStore,
  ): BuildSiteJobResult {
    const ready = this.validateBuildTick(jobId, tick, workTicks);
    if (!ready.ok) {
      return ready;
    }

    const ticked = jobCore.tickJob(jobId, tick, workTicks);
    if (!ticked.ok) {
      return { ok: false, reason: "job_core.failed" };
    }

    const siteId = this.jobSiteId[jobId] ?? 0;
    this.buildProgressTicks[siteId] = ticked.progressQ16;
    return this.finishJob(jobId, siteId);
  }

  completeBuild(
    jobId: number,
    tick: Tick,
    registry: EntityRegistry,
    grid: MapGrid,
    locations: LocationStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): BuildSiteCompletionResult {
    const ready = this.validateBuildComplete(jobId, tick, grid);
    if (!ready.ok) {
      return ready;
    }

    const allocated = registry.allocate();
    if (!allocated.ok) {
      return { ok: false, reason: "entity.capacity_exhausted" };
    }

    const placed = locations.placeOnMap(
      allocated.entity,
      registry,
      grid,
      ready.anchorX,
      ready.anchorY,
    );
    if (!placed.ok) {
      registry.destroy(allocated.entity);
      return { ok: false, reason: "map.location_failed" };
    }

    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      locations.destroyAndCleanup(allocated.entity, registry, grid);
      return { ok: false, reason: "job_core.failed" };
    }

    this.siteState[ready.siteId] = SITE_COMPLETED;
    this.activeSiteCount -= 1;
    this.completedSiteCount += 1;
    this.completedBuildingCount += 1;
    this.buildingEntityIndex[ready.siteId] = allocated.entity.index;
    this.buildingEntityGeneration[ready.siteId] = allocated.entity.generation;
    this.lanternState[ready.siteId] = BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL;
    this.jobStep[jobId] = JOB_BUILT;
    return {
      ok: true,
      jobId,
      siteId: ready.siteId,
      building: allocated.entity,
      version: this.bumpVersion(),
    };
  }

  syncOffers(
    siteId: number,
    offers: WorkOfferIndex,
    ledger?: ReservationLedger,
  ): BuildSiteMutationResult {
    if (!this.isActiveOrCompletedSite(siteId)) {
      return { ok: false, reason: "site.not_active" };
    }

    const syncA = this.syncMaterialOffer(siteId, 0, offers, ledger);
    if (!syncA.ok) {
      return syncA;
    }

    const syncB = this.syncMaterialOffer(siteId, 1, offers, ledger);
    if (!syncB.ok) {
      return syncB;
    }

    const syncBuild = this.syncBuildOffer(siteId, offers);
    if (!syncBuild.ok) {
      return syncBuild;
    }

    return this.finishSite(siteId);
  }

  readSite(siteId: number, ledger?: ReservationLedger): BuildSiteView | undefined {
    if (!this.isActiveOrCompletedSite(siteId)) {
      return undefined;
    }

    const reservedA = this.readReservedCapacity(siteId, 0, ledger);
    const reservedB = this.readReservedCapacity(siteId, 1, ledger);
    return {
      siteId,
      site: this.readSiteEntity(siteId),
      active: (this.siteState[siteId] ?? SITE_INACTIVE) === SITE_ACTIVE,
      completed: (this.siteState[siteId] ?? SITE_INACTIVE) === SITE_COMPLETED,
      blueprintDefId: this.blueprintDefId[siteId] ?? 0,
      anchorX: this.anchorX[siteId] ?? 0,
      anchorY: this.anchorY[siteId] ?? 0,
      anchorCellIndex: this.anchorCellIndex[siteId] ?? 0,
      interactionCellA: this.interactionCellA[siteId] ?? 0,
      interactionCellB: this.interactionCellB[siteId] ?? 0,
      requiredDefA: this.requiredDefA[siteId] ?? 0,
      requiredDefB: this.requiredDefB[siteId] ?? 0,
      requiredAmountA: this.requiredAmountA[siteId] ?? 0,
      requiredAmountB: this.requiredAmountB[siteId] ?? 0,
      deliveredAmountA: this.deliveredAmountA[siteId] ?? 0,
      deliveredAmountB: this.deliveredAmountB[siteId] ?? 0,
      reservedCapacityA: reservedA,
      reservedCapacityB: reservedB,
      remainingDemandA: this.remainingDemand(siteId, 0, ledger),
      remainingDemandB: this.remainingDemand(siteId, 1, ledger),
      buildProgressTicks: this.buildProgressTicks[siteId] ?? 0,
      buildRequiredTicks: this.buildRequiredTicks[siteId] ?? 0,
      buildingEntityIndex: this.buildingEntityIndex[siteId] ?? 0,
      buildingEntityGeneration: this.buildingEntityGeneration[siteId] ?? 0,
      lanternState: this.lanternState[siteId] ?? 0,
    };
  }

  readJob(jobId: number): BuildSiteJobView | undefined {
    if (!this.isJobIdInRange(jobId) || (this.jobActive[jobId] ?? 0) !== 1) {
      return undefined;
    }

    return {
      jobId,
      siteId: this.jobSiteId[jobId] ?? 0,
      mode: decodeJobMode(this.jobMode[jobId] ?? JOB_MODE_NONE),
      step: decodeJobStep(this.jobStep[jobId] ?? JOB_INACTIVE),
      owner: this.readJobOwner(jobId),
      sourceStackId: this.jobSourceStackId[jobId] ?? 0,
      defId: this.jobDefId[jobId] ?? 0xffff_ffff,
      amount: this.jobAmount[jobId] ?? 0,
    };
  }

  createMetrics(): BuildSiteMetrics {
    let deliveredTotal = 0;
    let progressTotal = 0;
    let demandOfferCount = 0;
    let buildOfferCount = 0;

    for (let siteId = 0; siteId < this.siteCapacity; siteId += 1) {
      if ((this.siteState[siteId] ?? SITE_INACTIVE) !== SITE_INACTIVE) {
        deliveredTotal +=
          (this.deliveredAmountA[siteId] ?? 0) + (this.deliveredAmountB[siteId] ?? 0);
        progressTotal += this.buildProgressTicks[siteId] ?? 0;
        demandOfferCount += (this.offerStateA[siteId] ?? 0) + (this.offerStateB[siteId] ?? 0);
        buildOfferCount += this.offerStateBuild[siteId] ?? 0;
      }
    }

    return {
      version: this.storeVersion,
      activeSiteCount: this.activeSiteCount,
      completedSiteCount: this.completedSiteCount,
      activeJobCount: this.activeJobCount,
      deliveredTotal,
      buildProgressTotal: progressTotal,
      completedBuildingCount: this.completedBuildingCount,
      demandOfferCount,
      buildOfferCount,
    };
  }

  private validateCreateSite(
    input: BuildSiteCreateInput,
    registry: EntityRegistry | undefined,
  ): BuildSiteMutationResult {
    if (!this.isSiteIdInRange(input.siteId)) {
      return { ok: false, reason: "site.id_out_of_range" };
    }

    if ((this.siteState[input.siteId] ?? SITE_INACTIVE) !== SITE_INACTIVE) {
      return { ok: false, reason: "site.already_active" };
    }

    if (registry !== undefined && !registry.isAlive(input.site)) {
      return { ok: false, reason: "site.entity_invalid" };
    }

    if (
      !isUint32(input.blueprintDefId) ||
      !isUint32(input.requiredDefIds[0]) ||
      !isUint32(input.requiredDefIds[1]) ||
      !isPositiveUint32(input.requiredAmounts[0]) ||
      !isPositiveUint32(input.requiredAmounts[1]) ||
      !isPositiveUint32(input.buildRequiredTicks)
    ) {
      return { ok: false, reason: "target.invalid_state" };
    }

    return { ok: true, siteId: input.siteId, version: this.storeVersion };
  }

  private validateDeliveryCreate(
    input: BuildSiteDeliveryJobInput,
    registry: EntityRegistry,
  ): BuildSiteJobResult {
    const site = this.validateActiveSite(input.siteId);
    if (!site.ok) {
      return { ok: false, reason: site.reason };
    }

    if (!this.isJobIdInRange(input.jobId)) {
      return { ok: false, reason: "site.job_id_out_of_range" };
    }

    if ((this.jobActive[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "site.job_already_active" };
    }

    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "site.entity_invalid" };
    }

    if (!isSafeTick(input.createdTick)) {
      return { ok: false, reason: "site.tick_invalid" };
    }

    const slot = this.materialSlot(input.siteId, input.defId);
    if (slot < 0 || !isPositiveUint32(input.amount)) {
      return { ok: false, reason: "material.def_not_required" };
    }

    return { ok: true, jobId: input.jobId, siteId: input.siteId, version: this.storeVersion };
  }

  private validateDeliveryReady(
    jobId: number,
    tick: Tick,
    items: ItemStackStore,
    ledger: ReservationLedger,
  ):
    | { readonly ok: true; readonly stack: ItemStackView; readonly capacity: number }
    | { readonly ok: false; readonly reason: BuildSiteReason } {
    const ready = this.validateJobStep(jobId, JOB_MODE_DELIVERY, JOB_CREATED, tick);
    if (!ready.ok) {
      return ready;
    }

    const siteId = this.jobSiteId[jobId] ?? 0;
    const stack = items.readStack(this.jobSourceStackId[jobId] ?? 0, ledger);
    const defId = this.jobDefId[jobId] ?? 0;
    const amount = this.jobAmount[jobId] ?? 0;
    if (stack?.defId !== defId) {
      return { ok: false, reason: "material.def_not_required" };
    }

    if (stack.availableQuantity < amount) {
      return { ok: false, reason: "material.insufficient_required_amount" };
    }

    const slot = this.materialSlot(siteId, defId);
    if (slot !== 0 && slot !== 1) {
      return { ok: false, reason: "material.insufficient_required_amount" };
    }

    const capacity = this.remainingMaterialCapacity(siteId, slot);
    if (amount > capacity) {
      return { ok: false, reason: "material.insufficient_required_amount" };
    }

    return { ok: true, stack, capacity };
  }

  private validateDeliveryCommit(
    jobId: number,
    tick: Tick,
    jobCore: JobCoreStore,
  ):
    | { readonly ok: true; readonly siteId: number; readonly slot: 0 | 1; readonly amount: number }
    | { readonly ok: false; readonly reason: BuildSiteReason } {
    const ready = this.validateJobStep(jobId, JOB_MODE_DELIVERY, JOB_PICKED_UP, tick);
    if (!ready.ok) {
      return ready;
    }

    const job = jobCore.readJob(jobId);
    const defId = this.jobDefId[jobId] ?? 0;
    const amount = this.jobAmount[jobId] ?? 0;
    if (job === undefined) {
      return { ok: false, reason: "job_core.failed" };
    }

    if (job.carriedDefId !== defId || job.carriedAmount !== amount) {
      return { ok: false, reason: "job_core.failed" };
    }

    const siteId = this.jobSiteId[jobId] ?? 0;
    const slot = this.materialSlot(siteId, defId);
    if (slot !== 0 && slot !== 1) {
      return { ok: false, reason: "material.capacity_exceeded" };
    }

    if (amount > this.remainingMaterialCapacity(siteId, slot)) {
      return { ok: false, reason: "material.capacity_exceeded" };
    }

    return { ok: true, siteId, slot, amount };
  }

  private validateBuildCreate(input: BuildSiteBuildJobInput): BuildSiteJobResult {
    const site = this.validateActiveSite(input.siteId);
    if (!site.ok) {
      return { ok: false, reason: site.reason };
    }

    if (!this.materialsReady(input.siteId)) {
      return { ok: false, reason: "material.insufficient_required_amount" };
    }

    if (!this.isJobIdInRange(input.jobId)) {
      return { ok: false, reason: "site.job_id_out_of_range" };
    }

    if ((this.jobActive[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "site.job_already_active" };
    }

    if (!isSafeTick(input.createdTick)) {
      return { ok: false, reason: "site.tick_invalid" };
    }

    return { ok: true, jobId: input.jobId, siteId: input.siteId, version: this.storeVersion };
  }

  private validateBuildTick(jobId: number, tick: Tick, workTicks: number): BuildSiteJobResult {
    const ready = this.validateJobStep(jobId, JOB_MODE_BUILD, JOB_BUILDING, tick);
    if (!ready.ok) {
      return ready;
    }

    const siteId = this.jobSiteId[jobId] ?? 0;
    if (!this.materialsReady(siteId)) {
      return { ok: false, reason: "material.insufficient_required_amount" };
    }

    if (!isPositiveUint32(workTicks)) {
      return { ok: false, reason: "site.progress_invalid" };
    }

    return { ok: true, jobId, siteId, version: this.storeVersion };
  }

  private validateBuildComplete(
    jobId: number,
    tick: Tick,
    grid: MapGrid,
  ):
    | {
        readonly ok: true;
        readonly siteId: number;
        readonly anchorX: number;
        readonly anchorY: number;
      }
    | { readonly ok: false; readonly reason: BuildSiteReason } {
    const ready = this.validateJobStep(jobId, JOB_MODE_BUILD, JOB_BUILDING, tick);
    if (!ready.ok) {
      return ready;
    }

    const siteId = this.jobSiteId[jobId] ?? 0;
    if ((this.buildProgressTicks[siteId] ?? 0) < (this.buildRequiredTicks[siteId] ?? 0)) {
      return { ok: false, reason: "site.progress_invalid" };
    }

    const cell = grid.readCell(this.anchorX[siteId] ?? 0, this.anchorY[siteId] ?? 0);
    if (!cell.ok || cell.cell.occupancy !== 0) {
      return { ok: false, reason: "site.blocked" };
    }

    return {
      ok: true,
      siteId,
      anchorX: this.anchorX[siteId] ?? 0,
      anchorY: this.anchorY[siteId] ?? 0,
    };
  }

  private validateJobStep(
    jobId: number,
    mode: number,
    step: number,
    tick: Tick,
  ): BuildSiteJobResult {
    if (!this.isJobIdInRange(jobId)) {
      return { ok: false, reason: "site.job_id_out_of_range" };
    }

    if ((this.jobActive[jobId] ?? 0) !== 1) {
      return { ok: false, reason: "site.job_not_active" };
    }

    if ((this.jobMode[jobId] ?? JOB_MODE_NONE) !== mode) {
      return { ok: false, reason: "site.job_mode_invalid" };
    }

    if ((this.jobStep[jobId] ?? JOB_INACTIVE) !== step) {
      return { ok: false, reason: "site.job_step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "site.tick_invalid" };
    }

    return { ok: true, jobId, siteId: this.jobSiteId[jobId] ?? 0, version: this.storeVersion };
  }

  private validateActiveSite(siteId: number): BuildSiteMutationResult {
    if (!this.isSiteIdInRange(siteId)) {
      return { ok: false, reason: "site.id_out_of_range" };
    }

    if ((this.siteState[siteId] ?? SITE_INACTIVE) !== SITE_ACTIVE) {
      return { ok: false, reason: "target.invalid_state" };
    }

    return { ok: true, siteId, version: this.storeVersion };
  }

  private syncMaterialOffer(
    siteId: number,
    materialSlot: 0 | 1,
    offers: WorkOfferIndex,
    ledger: ReservationLedger | undefined,
  ): BuildSiteMutationResult {
    const needed = this.remainingDemand(siteId, materialSlot, ledger) > 0;
    const active = this.readOfferState(siteId, materialSlot) === 1;
    const offerId = this.readMaterialOfferId(siteId, materialSlot);

    if (needed) {
      const input = this.createMaterialOfferInput(siteId, materialSlot, offerId);
      const result = active ? offers.updateOffer(input) : offers.registerOffer(input);
      if (!result.ok) {
        return { ok: false, reason: "work_offer.failed" };
      }
      this.writeOfferState(siteId, materialSlot, 1);
      return { ok: true, siteId, version: this.storeVersion };
    }

    if (active) {
      const removed = offers.removeOffer(offerId);
      if (!removed.ok) {
        return { ok: false, reason: "work_offer.failed" };
      }
      this.writeOfferState(siteId, materialSlot, 0);
    }

    return { ok: true, siteId, version: this.storeVersion };
  }

  private syncBuildOffer(siteId: number, offers: WorkOfferIndex): BuildSiteMutationResult {
    const needed =
      (this.siteState[siteId] ?? SITE_INACTIVE) === SITE_ACTIVE &&
      this.materialsReady(siteId) &&
      (this.buildProgressTicks[siteId] ?? 0) < (this.buildRequiredTicks[siteId] ?? 0);
    const active = (this.offerStateBuild[siteId] ?? 0) === 1;
    const offerId = this.buildOffer[siteId] ?? 0;

    if (needed) {
      const result = active
        ? offers.updateOffer(this.createBuildOfferInput(siteId, offerId))
        : offers.registerOffer(this.createBuildOfferInput(siteId, offerId));
      if (!result.ok) {
        return { ok: false, reason: "work_offer.failed" };
      }
      this.offerStateBuild[siteId] = 1;
      return { ok: true, siteId, version: this.storeVersion };
    }

    if (active) {
      const removed = offers.removeOffer(offerId);
      if (!removed.ok) {
        return { ok: false, reason: "work_offer.failed" };
      }
      this.offerStateBuild[siteId] = 0;
    }

    return { ok: true, siteId, version: this.storeVersion };
  }

  private createMaterialOfferInput(siteId: number, slot: 0 | 1, offerId: number): WorkOfferInput {
    return {
      offerId,
      workType: this.deliverWorkType[siteId] ?? 0,
      regionId: this.regionId[siteId] ?? 0,
      defId: slot === 0 ? (this.requiredDefA[siteId] ?? 0) : (this.requiredDefB[siteId] ?? 0),
      urgencyBucket: this.urgencyBucket[siteId] ?? 0,
      permissionId: this.permissionId[siteId] ?? 0,
      targetId: this.siteEntityIndex[siteId] ?? 0,
      targetCellIndex: this.anchorCellIndex[siteId] ?? 0,
      scoreMilli: this.remainingDemand(siteId, slot) * 1_000,
    };
  }

  private createBuildOfferInput(siteId: number, offerId: number): WorkOfferInput {
    return {
      offerId,
      workType: this.buildWorkType[siteId] ?? 0,
      regionId: this.regionId[siteId] ?? 0,
      defId: this.blueprintDefId[siteId] ?? 0,
      urgencyBucket: this.urgencyBucket[siteId] ?? 0,
      permissionId: this.permissionId[siteId] ?? 0,
      targetId: this.siteEntityIndex[siteId] ?? 0,
      targetCellIndex: this.anchorCellIndex[siteId] ?? 0,
      scoreMilli: 10_000,
    };
  }

  private writeJob(input: BuildSiteDeliveryJobInput, mode: number, step: number): void {
    this.jobActive[input.jobId] = 1;
    this.jobMode[input.jobId] = mode;
    this.jobStep[input.jobId] = step;
    this.jobSiteId[input.jobId] = input.siteId;
    this.jobOwnerIndex[input.jobId] = input.owner.index;
    this.jobOwnerGeneration[input.jobId] = input.owner.generation;
    this.jobSourceStackId[input.jobId] = input.sourceStackId;
    this.jobDefId[input.jobId] = input.defId;
    this.jobAmount[input.jobId] = input.amount;
    this.activeJobCount += 1;
  }

  private writeBuildJob(input: BuildSiteBuildJobInput, step: number): void {
    this.jobActive[input.jobId] = 1;
    this.jobMode[input.jobId] = JOB_MODE_BUILD;
    this.jobStep[input.jobId] = step;
    this.jobSiteId[input.jobId] = input.siteId;
    this.jobOwnerIndex[input.jobId] = input.owner.index;
    this.jobOwnerGeneration[input.jobId] = input.owner.generation;
    this.jobDefId[input.jobId] = 0xffff_ffff;
    this.jobAmount[input.jobId] = 0;
    this.activeJobCount += 1;
  }

  private materialSlot(siteId: number, defId: number): 0 | 1 | -1 {
    if ((this.requiredDefA[siteId] ?? 0) === defId) {
      return 0;
    }

    if ((this.requiredDefB[siteId] ?? 0) === defId) {
      return 1;
    }

    return -1;
  }

  private remainingDemand(siteId: number, slot: 0 | 1, ledger?: ReservationLedger): number {
    const required =
      slot === 0 ? (this.requiredAmountA[siteId] ?? 0) : (this.requiredAmountB[siteId] ?? 0);
    const delivered =
      slot === 0 ? (this.deliveredAmountA[siteId] ?? 0) : (this.deliveredAmountB[siteId] ?? 0);
    const reserved = this.readReservedCapacity(siteId, slot, ledger);
    const claimed = delivered + reserved;
    return required > claimed ? required - claimed : 0;
  }

  private remainingMaterialCapacity(siteId: number, slot: 0 | 1): number {
    const required =
      slot === 0 ? (this.requiredAmountA[siteId] ?? 0) : (this.requiredAmountB[siteId] ?? 0);
    const delivered =
      slot === 0 ? (this.deliveredAmountA[siteId] ?? 0) : (this.deliveredAmountB[siteId] ?? 0);
    return required > delivered ? required - delivered : 0;
  }

  private readReservedCapacity(
    siteId: number,
    slot: 0 | 1,
    ledger: ReservationLedger | undefined,
  ): number {
    if (ledger === undefined) {
      return 0;
    }

    const defId = slot === 0 ? (this.requiredDefA[siteId] ?? 0) : (this.requiredDefB[siteId] ?? 0);
    return ledger.reservedAmountForCapacity(this.readSiteEntity(siteId), defId);
  }

  private materialsReady(siteId: number): boolean {
    return (
      (this.deliveredAmountA[siteId] ?? 0) >= (this.requiredAmountA[siteId] ?? 0) &&
      (this.deliveredAmountB[siteId] ?? 0) >= (this.requiredAmountB[siteId] ?? 0)
    );
  }

  private addDeliveredUnchecked(siteId: number, slot: 0 | 1, amount: number): void {
    if (slot === 0) {
      this.deliveredAmountA[siteId] = (this.deliveredAmountA[siteId] ?? 0) + amount;
    } else {
      this.deliveredAmountB[siteId] = (this.deliveredAmountB[siteId] ?? 0) + amount;
    }
  }

  private removeDeliveredUnchecked(siteId: number, slot: 0 | 1, amount: number): void {
    if (slot === 0) {
      this.deliveredAmountA[siteId] = (this.deliveredAmountA[siteId] ?? 0) - amount;
    } else {
      this.deliveredAmountB[siteId] = (this.deliveredAmountB[siteId] ?? 0) - amount;
    }
  }

  private restoreSourceQuantity(
    items: ItemStackStore,
    stackId: number,
    amount: number,
    defId: number,
  ): void {
    const restored = items.addQuantity(stackId, amount, defId);
    if (!restored.ok) {
      throw new Error(`failed to restore build-site source quantity: ${restored.reason}`);
    }
  }

  private isActiveOrCompletedSite(siteId: number): boolean {
    return (
      this.isSiteIdInRange(siteId) && (this.siteState[siteId] ?? SITE_INACTIVE) !== SITE_INACTIVE
    );
  }

  private isSiteIdInRange(siteId: number): boolean {
    return Number.isSafeInteger(siteId) && siteId >= 0 && siteId < this.siteCapacity;
  }

  private isJobIdInRange(jobId: number): boolean {
    return Number.isSafeInteger(jobId) && jobId >= 0 && jobId < this.jobCapacity;
  }

  private readSiteEntity(siteId: number): EntityId {
    return {
      index: this.siteEntityIndex[siteId] ?? 0,
      generation: this.siteEntityGeneration[siteId] ?? 0,
    };
  }

  private readJobOwner(jobId: number): EntityId {
    return {
      index: this.jobOwnerIndex[jobId] ?? 0,
      generation: this.jobOwnerGeneration[jobId] ?? 0,
    };
  }

  private readMaterialOfferId(siteId: number, slot: 0 | 1): number {
    return slot === 0 ? (this.materialOfferA[siteId] ?? 0) : (this.materialOfferB[siteId] ?? 0);
  }

  private readOfferState(siteId: number, slot: 0 | 1): number {
    return slot === 0 ? (this.offerStateA[siteId] ?? 0) : (this.offerStateB[siteId] ?? 0);
  }

  private writeOfferState(siteId: number, slot: 0 | 1, state: 0 | 1): void {
    if (slot === 0) {
      this.offerStateA[siteId] = state;
    } else {
      this.offerStateB[siteId] = state;
    }
  }

  private finishSite(siteId: number): BuildSiteMutationResult {
    return { ok: true, siteId, version: this.bumpVersion() };
  }

  private finishJob(jobId: number, siteId: number): BuildSiteJobResult {
    return { ok: true, jobId, siteId, version: this.bumpVersion() };
  }

  private bumpVersion(): number {
    this.storeVersion += 1;
    return this.storeVersion;
  }
}

export function createBuildSiteStore(siteCapacity: number, jobCapacity: number): BuildSiteStore {
  return new BuildSiteStore(siteCapacity, jobCapacity);
}

export function mapPathFailure(reason: "source" | "destination" | "blocked"): BuildSiteReason {
  if (reason === "source") {
    return "path.no_route_to_source";
  }

  if (reason === "destination") {
    return "path.no_route_to_destination";
  }

  return "site.blocked";
}

function mapReservationReason(reason: ReservationReason): BuildSiteReason {
  if (reason === "reservation_capacity_conflict") {
    return "reservation.destination_capacity_conflict";
  }

  if (reason === "reservation_interaction_conflict" || reason === "reservation_entity_conflict") {
    return "reservation.interaction_conflict";
  }

  if (reason === "reservation_item_quantity_conflict") {
    return "reservation.source_quantity_conflict";
  }

  if (reason === "reservation_insufficient_amount") {
    return "material.insufficient_required_amount";
  }

  if (reason === "reservation_insufficient_capacity") {
    return "material.capacity_exceeded";
  }

  return "reservation.failed";
}

function decodeJobMode(mode: number): "none" | "delivery" | "build" {
  if (mode === JOB_MODE_DELIVERY) {
    return "delivery";
  }

  if (mode === JOB_MODE_BUILD) {
    return "build";
  }

  return "none";
}

function decodeJobStep(step: number): BuildSiteJobStep {
  if (step === JOB_CREATED) {
    return "created";
  }

  if (step === JOB_RESERVED) {
    return "reserved";
  }

  if (step === JOB_PICKED_UP) {
    return "picked_up";
  }

  if (step === JOB_DELIVERED) {
    return "delivered";
  }

  if (step === JOB_BUILDING) {
    return "building";
  }

  if (step === JOB_BUILT) {
    return "built";
  }

  if (step === JOB_CANCELED) {
    return "canceled";
  }

  return "inactive";
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}
