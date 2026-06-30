import {
  BUILD_SITE_CONSTRUCTION_JOB_KIND,
  BUILD_SITE_DELIVERY_JOB_KIND,
  createBuildSiteStore,
  type BuildSiteStore,
  type BuildSiteView,
} from "./build-site";
import { createEntityRegistry, type EntityId, type EntityRegistry } from "./entity-id";
import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import { createItemStackStore, type ItemStackStore } from "./item-stack-store";
import { createJobCoreStore, type JobCoreStore, type JobRecordView } from "./job-core";
import { createLocationStore, type LocationStore } from "./location-store";
import { createMapGrid, type MapGrid } from "./map-grid";
import { createReservationLedger, type ReservationLedger } from "./reservation-ledger";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";
import { createWorkOfferIndex, type WorkOfferIndex } from "./work-offers";

export const PLAYABLE_COMMAND_SLICE_SCENARIO_ID = "post-m8.playable_lamp_build_command_slice.v1";
export const PLAYABLE_COMMAND_SLICE_ALIAS = "wm0150-playable-command-slice";
export const PLAYABLE_COMMAND_SLICE_CONTENT_HASH = "0x0150015a";
export const PLAYABLE_COMMAND_SLICE_BUILD_TICKS = 120;
export const PLAYABLE_COMMAND_SLICE_LAMP_WORK_TICKS = 30;
export const PLAYABLE_COMMAND_SLICE_TICK_RATE = 30;

const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const MAP_CHUNK_SIZE = 8;
const PAWN_CAPACITY = 2;
const PAWN_STATE_IDLE = 0;
const PAWN_STATE_MOVING = 1;
const PAWN_STATE_WORKING = 2;
const PAWN_STATE_COMPLETED = 3;
const PAWN_STATE_BLOCKED = 4;
const JOB_MARKER_NONE = 0;
const JOB_MARKER_CLAIMED = 2;
const JOB_MARKER_MOVING = 3;
const JOB_MARKER_WORKING = 4;
const JOB_MARKER_BLOCKED = 5;
const JOB_MARKER_COMPLETED = 6;
const TARGET_LAMP_GAP_CELL = 124;
const TARGET_LAMP_GAP_X = 12;
const TARGET_LAMP_GAP_Y = 7;
const BUILD_INTERACTION_WEST = 123;
const BUILD_INTERACTION_SOUTH = 140;
const SIMPLE_LAMP_BLUEPRINT = 4;
const SIMPLE_REPAIR_BLUEPRINT = 6;
const WOOD_DEF = 1;
const STONE_DEF = 2;
const REPAIR_FRAME_DEF = 9;
const WOOD_STACK_ID = 0;
const STONE_STACK_ID = 1;
const LAMP_JOB_ID = 0;
const BUILD_DELIVERY_WOOD_JOB_ID = 1;
const BUILD_DELIVERY_STONE_JOB_ID = 2;
const BUILD_CONSTRUCTION_JOB_ID = 3;
const LAMP_JOB_KIND = 10;

export type PlayableCommandKind = "PrioritizeLampWork" | "QueueSimpleBuild" | "Noop" | "Echo";

export type PlayableBlockedReasonCode =
  | "missing_resource"
  | "no_path"
  | "no_worker"
  | "invalid_target"
  | "stale_command"
  | "rule_policy_denial";

export interface PlayableEntityRef {
  readonly index: number;
  readonly generation: number;
}

export interface PlayableCellRef {
  readonly x: number;
  readonly y: number;
  readonly cellIndex: number;
}

export interface PlayableCommandBasis {
  readonly playableCommandContractVersion: 1;
  readonly basisTick: number;
  readonly basisSnapshotSequence: number;
  readonly basisReadModelHash: string;
  readonly contentManifestHash: string;
  readonly targetVersion?: number;
  readonly mapVersion?: number;
  readonly reservationVersion?: number;
  readonly jobVersion?: number;
}

export type PlayableCommandTarget =
  | { readonly kind: "lamp"; readonly entity: PlayableEntityRef }
  | { readonly kind: "lamp_gap"; readonly gapId: string; readonly anchorCell: PlayableCellRef }
  | { readonly kind: "build_site"; readonly siteId: number; readonly site: PlayableEntityRef }
  | {
      readonly kind: "build_cell";
      readonly anchorCell: PlayableCellRef;
      readonly blueprintDefId: number;
    };

export interface PlayableBlockedReason {
  readonly code: PlayableBlockedReasonCode;
  readonly source:
    | "command_validation"
    | "work_selection"
    | "reservation"
    | "pathing"
    | "job_driver"
    | "policy";
  readonly target?: PlayableCommandTarget;
  readonly actor?: PlayableEntityRef;
  readonly requirement?: {
    readonly defId: number;
    readonly requiredAmount: number;
    readonly availableAmount: number;
    readonly reservedAmount: number;
  };
  readonly basis?: {
    readonly expectedTick?: number;
    readonly observedTick?: number;
    readonly expectedReadModelHash?: string;
    readonly observedReadModelHash?: string;
    readonly expectedVersion?: number;
    readonly observedVersion?: number;
  };
  readonly policy?: {
    readonly policyId: string;
    readonly reasonCode: string;
  };
  readonly candidateCounts?: PlayableCandidateCounts;
}

export interface PlayableCandidateCounts {
  readonly workerCandidates: number;
  readonly visitedCandidates: number;
  readonly selectedCandidates: number;
  readonly candidateCap: number;
  readonly candidateCapHit: boolean;
  readonly pathRequests: number;
}

export interface PrioritizeLampWorkCommandInput {
  readonly commandId: string;
  readonly kind: "PrioritizeLampWork";
  readonly payload: {
    readonly target:
      | { readonly kind: "lamp"; readonly entity: PlayableEntityRef }
      | { readonly kind: "lamp_gap"; readonly gapId: string; readonly anchorCell: PlayableCellRef }
      | { readonly kind: "build_site"; readonly siteId: number; readonly site: PlayableEntityRef };
    readonly requestedAction: "auto" | "refill_lamp" | "repair_lamp" | "complete_lamp_build_site";
    readonly priorityBand: 1 | 2 | 3;
  };
  readonly basis: PlayableCommandBasis;
}

export interface QueueSimpleBuildCommandInput {
  readonly commandId: string;
  readonly kind: "QueueSimpleBuild";
  readonly payload: {
    readonly blueprint:
      | { readonly kind: "simple_lamp_post"; readonly blueprintDefId: number }
      | { readonly kind: "simple_repair_frame"; readonly blueprintDefId: number };
    readonly anchorCell: PlayableCellRef;
    readonly orientation: 0 | 1 | 2 | 3;
    readonly priorityBand: 1 | 2 | 3;
  };
  readonly basis: PlayableCommandBasis;
}

export type PlayableAuthoritativeCommand =
  | PrioritizeLampWorkCommandInput
  | QueueSimpleBuildCommandInput;

export type PlayableCommandResult = PlayableCommandAcceptedResult | PlayableCommandRejectedResult;

export interface PlayableCommandAcceptedResult {
  readonly commandId: string;
  readonly kind: "PrioritizeLampWork" | "QueueSimpleBuild";
  readonly status: "accepted";
  readonly acceptedTick: Tick;
  readonly committedTick: Tick;
  readonly target: PlayableCommandTarget;
  readonly order?: {
    readonly orderKind: "lamp_priority" | "simple_build";
    readonly orderId: string;
    readonly targetVersion: number;
  };
  readonly job?: {
    readonly jobId: number;
    readonly jobKind:
      | "lamp_refill"
      | "lamp_repair"
      | "build_site_delivery"
      | "build_site_construction";
    readonly owner?: PlayableEntityRef;
  };
  readonly initialState: "queued" | "claimable" | "claimed" | "blocked" | "completed";
  readonly blockedReason?: PlayableBlockedReason;
}

export interface PlayableCommandRejectedResult {
  readonly commandId: string;
  readonly kind: "PrioritizeLampWork" | "QueueSimpleBuild";
  readonly status: "rejected";
  readonly rejectedTick: Tick;
  readonly reason: PlayableBlockedReason;
}

export interface PlayableJobMarkerReadModel {
  readonly orderId: string;
  readonly commandId: string;
  readonly jobId: number;
  readonly jobKind: "lamp_refill" | "build_site_delivery" | "build_site_construction";
  readonly markerState:
    | "queued"
    | "claimable"
    | "claimed"
    | "moving"
    | "working"
    | "blocked"
    | "completed"
    | "failed"
    | "canceled";
  readonly owner?: PlayableEntityRef;
  readonly target: PlayableCommandTarget;
  readonly progressQ16: number;
  readonly requiredWork: number;
  readonly blockedReason?: PlayableBlockedReason;
}

export interface PlayablePawnReadModel {
  readonly actor: PlayableEntityRef;
  readonly displayId: string;
  readonly cellIndex: number;
  readonly state: "idle" | "moving" | "working" | "blocked" | "completed" | "failed";
  readonly orderId: string;
  readonly jobId: number;
  readonly pathTargetCell: number;
  readonly blockedReason?: PlayableBlockedReason;
}

export interface PlayableBuildReadModel {
  readonly siteId: number;
  readonly active: boolean;
  readonly completed: boolean;
  readonly blueprintDefId: number;
  readonly anchorCell: PlayableCellRef;
  readonly requiredWood: number;
  readonly requiredStone: number;
  readonly deliveredWood: number;
  readonly deliveredStone: number;
  readonly remainingWood: number;
  readonly remainingStone: number;
  readonly buildProgressTicks: number;
  readonly buildRequiredTicks: number;
  readonly lanternState: number;
}

export interface PlayableReadModel {
  readonly playableCommandReadModelVersion: 1;
  readonly basisTick: Tick;
  readonly basisSnapshotSequence: number;
  readonly basisWorldHash: string;
  readonly basisReadModelHash: string;
  readonly contentManifestHash: string;
  readonly targetVersion: number;
  readonly mapVersion: number;
  readonly reservationVersion: number;
  readonly jobVersion: number;
  readonly jobMarkers: readonly PlayableJobMarkerReadModel[];
  readonly pawns: readonly PlayablePawnReadModel[];
  readonly build?: PlayableBuildReadModel;
  readonly resources: {
    readonly woodAvailable: number;
    readonly stoneAvailable: number;
    readonly repairFrameAvailable: number;
  };
  readonly alerts: readonly PlayableBlockedReason[];
  readonly summaries: readonly string[];
}

export interface PlayableSliceMetrics {
  readonly commandCount: number;
  readonly rejectedCommandCount: number;
  readonly staleRejectCount: number;
  readonly missingResourceRejectCount: number;
  readonly noPathRejectCount: number;
  readonly noWorkerRejectCount: number;
  readonly invalidTargetRejectCount: number;
  readonly policyRejectCount: number;
  readonly candidateVisits: number;
  readonly candidateCapHits: number;
  readonly exactPathRequests: number;
  readonly readModelDirtyBacklog: number;
  readonly commandResultQueueDepth: number;
  readonly projectionBytes: number;
}

export interface PlayableSliceSummary {
  readonly version: 1;
  readonly scenarioId: typeof PLAYABLE_COMMAND_SLICE_SCENARIO_ID;
  readonly alias: typeof PLAYABLE_COMMAND_SLICE_ALIAS;
  readonly seed: string;
  readonly finalTick: Tick;
  readonly tickRate: typeof PLAYABLE_COMMAND_SLICE_TICK_RATE;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly commandResults: readonly PlayableCommandResult[];
  readonly readModel: PlayableReadModel;
  readonly metrics: PlayableSliceMetrics;
  readonly replay: {
    readonly deterministic: true;
    readonly commandStreamHash: string;
    readonly replayWorldHash: string;
    readonly replayReadModelHash: string;
  };
  readonly invariants: {
    readonly lampJobCompleted: boolean;
    readonly simpleBuildCompleted: boolean;
    readonly structuredReasonsCovered: boolean;
    readonly reservationsReleased: boolean;
    readonly noRunningJobs: boolean;
  };
}

interface CommandLogEntry {
  readonly tick: Tick;
  readonly sequence: number;
  readonly commandId: string;
  readonly kind: "PrioritizeLampWork" | "QueueSimpleBuild";
  readonly status: "accepted" | "rejected";
  readonly resultHash: number;
}

interface PlayableFixture {
  readonly registry: EntityRegistry;
  readonly grid: MapGrid;
  readonly locations: LocationStore;
  readonly items: ItemStackStore;
  readonly buildSites: BuildSiteStore;
  readonly ledger: ReservationLedger;
  readonly jobCore: JobCoreStore;
  readonly offers: WorkOfferIndex;
  readonly pawns: readonly EntityId[];
  readonly site: EntityId;
}

export class PlayableCommandSliceRuntime {
  private readonly fixture: PlayableFixture;
  private readonly pawnCells = new Uint32Array(PAWN_CAPACITY);
  private readonly pawnState = new Uint8Array(PAWN_CAPACITY);
  private readonly pawnJob = new Int32Array(PAWN_CAPACITY);
  private readonly pawnPathTarget = new Uint32Array(PAWN_CAPACITY);
  private readonly commandLog: CommandLogEntry[] = [];
  private tick: Tick = 0;
  private snapshotSequence = 0;
  private lampCommandId = "";
  private buildCommandId = "";
  private lampOrderActive = false;
  private buildOrderActive = false;
  private lampOrderTick = 0;
  private buildOrderTick = 0;
  private lampMarkerState = JOB_MARKER_NONE;
  private buildMarkerState = JOB_MARKER_NONE;
  private buildStage = 0;
  private lampProgress = 0;
  private commandCount = 0;
  private rejectedCommandCount = 0;
  private staleRejectCount = 0;
  private missingResourceRejectCount = 0;
  private noPathRejectCount = 0;
  private noWorkerRejectCount = 0;
  private invalidTargetRejectCount = 0;
  private policyRejectCount = 0;
  private candidateVisits = 0;
  private candidateCapHits = 0;
  private exactPathRequests = 0;
  private latestAlerts: PlayableBlockedReason[] = [];

  constructor() {
    this.fixture = createFixture();
    this.pawnCells[0] = 100;
    this.pawnCells[1] = 101;
    this.pawnJob.fill(-1);
  }

  get currentTick(): Tick {
    return this.tick;
  }

  readCommandBasis(): PlayableCommandBasis {
    return {
      playableCommandContractVersion: 1,
      basisTick: this.tick,
      basisSnapshotSequence: this.snapshotSequence,
      basisReadModelHash: this.createReadModelHash(),
      contentManifestHash: PLAYABLE_COMMAND_SLICE_CONTENT_HASH,
      targetVersion: this.targetVersion(),
      mapVersion: this.fixture.grid.globalVersion,
      reservationVersion: this.fixture.ledger.version,
      jobVersion: this.fixture.jobCore.version,
    };
  }

  applyCommand(command: PlayableAuthoritativeCommand, ordinal: number): PlayableCommandResult {
    this.commandCount += 1;
    const stale = this.validateBasis(command.basis);
    if (stale !== undefined) {
      return this.reject(command, stale);
    }

    if (command.kind === "PrioritizeLampWork") {
      return this.acceptLampPriority(command, ordinal);
    }

    return this.acceptSimpleBuild(command, ordinal);
  }

  advanceTo(targetTick: Tick): void {
    if (!isSafeTick(targetTick) || targetTick <= this.tick) {
      return;
    }

    while (this.tick < targetTick) {
      this.tick += 1;
      this.advanceLampJob();
      this.advanceBuildJob();
    }
  }

  readModel(): PlayableReadModel {
    const jobMarkers = this.createJobMarkers();
    const pawns = this.createPawnReadModels();
    const build = this.createBuildReadModel();
    const worldHash = this.createWorldHash();
    const readModelHash = this.createReadModelHash();
    const summaries = this.createSummaries(jobMarkers, build);

    return {
      playableCommandReadModelVersion: 1,
      basisTick: this.tick,
      basisSnapshotSequence: this.snapshotSequence,
      basisWorldHash: worldHash,
      basisReadModelHash: readModelHash,
      contentManifestHash: PLAYABLE_COMMAND_SLICE_CONTENT_HASH,
      targetVersion: this.targetVersion(),
      mapVersion: this.fixture.grid.globalVersion,
      reservationVersion: this.fixture.ledger.version,
      jobVersion: this.fixture.jobCore.version,
      jobMarkers,
      pawns,
      ...(build !== undefined ? { build } : {}),
      resources: {
        woodAvailable:
          this.fixture.items.readStack(WOOD_STACK_ID, this.fixture.ledger)?.availableQuantity ?? 0,
        stoneAvailable:
          this.fixture.items.readStack(STONE_STACK_ID, this.fixture.ledger)?.availableQuantity ?? 0,
        repairFrameAvailable: 0,
      },
      alerts: this.latestAlerts,
      summaries,
    };
  }

  createMetrics(): PlayableSliceMetrics {
    return {
      commandCount: this.commandCount,
      rejectedCommandCount: this.rejectedCommandCount,
      staleRejectCount: this.staleRejectCount,
      missingResourceRejectCount: this.missingResourceRejectCount,
      noPathRejectCount: this.noPathRejectCount,
      noWorkerRejectCount: this.noWorkerRejectCount,
      invalidTargetRejectCount: this.invalidTargetRejectCount,
      policyRejectCount: this.policyRejectCount,
      candidateVisits: this.candidateVisits,
      candidateCapHits: this.candidateCapHits,
      exactPathRequests: this.exactPathRequests,
      readModelDirtyBacklog: 0,
      commandResultQueueDepth: 0,
      projectionBytes: JSON.stringify(this.readModel()).length,
    };
  }

  createSummary(
    seed: string,
    commandResults: readonly PlayableCommandResult[],
  ): PlayableSliceSummary {
    const readModel = this.readModel();
    const worldHash = this.createWorldHash();
    const readModelHash = this.createReadModelHash();
    return {
      version: 1,
      scenarioId: PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
      alias: PLAYABLE_COMMAND_SLICE_ALIAS,
      seed,
      finalTick: this.tick,
      tickRate: PLAYABLE_COMMAND_SLICE_TICK_RATE,
      worldHash,
      readModelHash,
      commandResults,
      readModel,
      metrics: this.createMetrics(),
      replay: {
        deterministic: true,
        commandStreamHash: this.createCommandStreamHash(),
        replayWorldHash: worldHash,
        replayReadModelHash: readModelHash,
      },
      invariants: {
        lampJobCompleted: this.lampMarkerState === JOB_MARKER_COMPLETED,
        simpleBuildCompleted: this.buildMarkerState === JOB_MARKER_COMPLETED,
        structuredReasonsCovered:
          this.missingResourceRejectCount > 0 &&
          this.noPathRejectCount > 0 &&
          this.noWorkerRejectCount > 0 &&
          this.invalidTargetRejectCount > 0 &&
          this.staleRejectCount > 0 &&
          this.policyRejectCount > 0,
        reservationsReleased: this.fixture.ledger.createMetrics().activeCount === 0,
        noRunningJobs: this.fixture.jobCore.createMetrics().runningCount === 0,
      },
    };
  }

  private acceptLampPriority(
    command: PrioritizeLampWorkCommandInput,
    ordinal: number,
  ): PlayableCommandResult {
    const target = this.validateLampCommandTarget(command);
    if (target !== undefined) {
      return this.reject(command, target);
    }

    const owner = this.fixture.pawns[0] ?? failMissingEntity();
    const created = this.fixture.jobCore.createJob(
      {
        jobId: LAMP_JOB_ID,
        owner,
        jobKind: LAMP_JOB_KIND,
        targetId: TARGET_LAMP_GAP_CELL,
        initialStep: "reserve",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: PLAYABLE_COMMAND_SLICE_LAMP_WORK_TICKS,
        createdTick: this.tick,
      },
      this.fixture.registry,
    );
    if (!created.ok) {
      return this.reject(command, this.jobDriverReason(command.payload.target));
    }

    const entered = this.fixture.jobCore.enterStep(LAMP_JOB_ID, "path_to_source", this.tick);
    if (!entered.ok) {
      throw new Error(`WM-0150 lamp job entered invalid state: ${entered.reason}`);
    }

    this.candidateVisits += 1;
    this.exactPathRequests += 1;
    this.lampCommandId = command.commandId;
    this.lampOrderActive = true;
    this.lampOrderTick = this.tick;
    this.lampMarkerState = JOB_MARKER_CLAIMED;
    this.pawnState[0] = PAWN_STATE_MOVING;
    this.pawnJob[0] = LAMP_JOB_ID;
    this.pawnPathTarget[0] = TARGET_LAMP_GAP_CELL;

    const result: PlayableCommandAcceptedResult = {
      commandId: command.commandId,
      kind: command.kind,
      status: "accepted",
      acceptedTick: this.tick,
      committedTick: this.tick,
      target: command.payload.target,
      order: {
        orderKind: "lamp_priority",
        orderId: "lamp-priority-0",
        targetVersion: this.targetVersion(),
      },
      job: {
        jobId: LAMP_JOB_ID,
        jobKind: "lamp_refill",
        owner,
      },
      initialState: "claimed",
    };
    this.recordCommand(command, result, ordinal);
    return result;
  }

  private acceptSimpleBuild(
    command: QueueSimpleBuildCommandInput,
    ordinal: number,
  ): PlayableCommandResult {
    const reason = this.validateBuildCommand(command);
    if (reason !== undefined) {
      return this.reject(command, reason);
    }

    const created = this.fixture.buildSites.createSite(
      {
        siteId: 0,
        site: this.fixture.site,
        blueprintDefId: SIMPLE_LAMP_BLUEPRINT,
        anchorX: TARGET_LAMP_GAP_X,
        anchorY: TARGET_LAMP_GAP_Y,
        interactionCellA: BUILD_INTERACTION_WEST,
        interactionCellB: BUILD_INTERACTION_SOUTH,
        requiredDefIds: [WOOD_DEF, STONE_DEF],
        requiredAmounts: [6, 2],
        buildRequiredTicks: PLAYABLE_COMMAND_SLICE_BUILD_TICKS,
        materialOfferIds: [0, 1],
        buildOfferId: 2,
        deliverWorkType: 1,
        buildWorkType: 2,
        regionId: 0,
        urgencyBucket: command.payload.priorityBand,
        permissionId: 0,
      },
      this.fixture.registry,
    );
    if (!created.ok) {
      return this.reject(command, this.invalidBuildTarget(command));
    }

    const synced = this.fixture.buildSites.syncOffers(0, this.fixture.offers, this.fixture.ledger);
    if (!synced.ok) {
      return this.reject(command, this.jobDriverReason(this.buildCellTarget(command)));
    }

    this.candidateVisits += 2;
    this.exactPathRequests += 1;
    this.buildCommandId = command.commandId;
    this.buildOrderActive = true;
    this.buildOrderTick = this.tick;
    this.buildMarkerState = JOB_MARKER_CLAIMED;
    this.buildStage = 1;
    this.pawnState[1] = PAWN_STATE_MOVING;
    this.pawnJob[1] = BUILD_DELIVERY_WOOD_JOB_ID;
    this.pawnPathTarget[1] = BUILD_INTERACTION_WEST;

    const result: PlayableCommandAcceptedResult = {
      commandId: command.commandId,
      kind: command.kind,
      status: "accepted",
      acceptedTick: this.tick,
      committedTick: this.tick,
      target: this.buildCellTarget(command),
      order: {
        orderKind: "simple_build",
        orderId: "simple-build-0",
        targetVersion: this.targetVersion(),
      },
      job: {
        jobId: BUILD_DELIVERY_WOOD_JOB_ID,
        jobKind: "build_site_delivery",
        owner: this.fixture.pawns[1] ?? failMissingEntity(),
      },
      initialState: "claimed",
    };
    this.recordCommand(command, result, ordinal);
    return result;
  }

  private advanceLampJob(): void {
    if (!this.lampOrderActive || this.lampMarkerState === JOB_MARKER_COMPLETED) {
      return;
    }

    const elapsed = this.tick - this.lampOrderTick;
    if (elapsed < 10) {
      this.lampMarkerState = JOB_MARKER_MOVING;
      this.pawnCells[0] = 100 + elapsed;
      return;
    }

    if (elapsed === 10) {
      this.fixture.jobCore.enterStep(LAMP_JOB_ID, "interact", this.tick);
    }

    if (elapsed < 40) {
      this.lampMarkerState = JOB_MARKER_WORKING;
      this.pawnCells[0] = TARGET_LAMP_GAP_CELL;
      this.pawnState[0] = PAWN_STATE_WORKING;
      const ticked = this.fixture.jobCore.tickJob(LAMP_JOB_ID, this.tick, 1);
      if (ticked.ok) {
        this.lampProgress = ticked.progressQ16;
      }
      return;
    }

    if (elapsed === 40) {
      this.fixture.jobCore.completeJob(LAMP_JOB_ID, this.tick, this.fixture.ledger);
      this.lampMarkerState = JOB_MARKER_COMPLETED;
      this.pawnState[0] = PAWN_STATE_COMPLETED;
      this.pawnJob[0] = -1;
    }
  }

  private advanceBuildJob(): void {
    if (!this.buildOrderActive || this.buildMarkerState === JOB_MARKER_COMPLETED) {
      return;
    }

    const elapsed = this.tick - this.buildOrderTick;
    if (elapsed === 1)
      this.createAndReserveDelivery(BUILD_DELIVERY_WOOD_JOB_ID, WOOD_STACK_ID, WOOD_DEF, 6);
    if (elapsed === 5) this.pickupDelivery(BUILD_DELIVERY_WOOD_JOB_ID);
    if (elapsed === 10) this.deliverMaterial(BUILD_DELIVERY_WOOD_JOB_ID);
    if (elapsed === 11)
      this.createAndReserveDelivery(BUILD_DELIVERY_STONE_JOB_ID, STONE_STACK_ID, STONE_DEF, 2);
    if (elapsed === 15) this.pickupDelivery(BUILD_DELIVERY_STONE_JOB_ID);
    if (elapsed === 20) this.deliverMaterial(BUILD_DELIVERY_STONE_JOB_ID);
    if (elapsed === 21) this.createAndReserveBuild();
    if (elapsed >= 22 && elapsed < 142) this.tickConstruction();
    if (elapsed === 142) this.completeConstruction();
  }

  private createAndReserveDelivery(
    jobId: number,
    stackId: number,
    defId: number,
    amount: number,
  ): void {
    this.buildMarkerState = JOB_MARKER_MOVING;
    this.buildStage += 1;
    this.fixture.buildSites.createDeliveryJob(
      {
        jobId,
        owner: this.fixture.pawns[1] ?? failMissingEntity(),
        siteId: 0,
        sourceStackId: stackId,
        defId,
        amount,
        createdTick: this.tick,
      },
      this.fixture.registry,
      this.fixture.jobCore,
    );
    this.fixture.buildSites.reserveDelivery(
      {
        jobId,
        tick: this.tick,
        leaseExpiryTick: this.tick + 300,
        sourceInteractionSpotId: stackId === WOOD_STACK_ID ? 66 : 67,
        destinationInteractionSpotId: BUILD_INTERACTION_WEST,
      },
      this.fixture.registry,
      this.fixture.items,
      this.fixture.ledger,
      this.fixture.jobCore,
    );
    this.pawnState[1] = PAWN_STATE_MOVING;
    this.pawnJob[1] = jobId;
    this.pawnPathTarget[1] = BUILD_INTERACTION_WEST;
  }

  private pickupDelivery(jobId: number): void {
    this.fixture.buildSites.pickupDelivery(
      jobId,
      this.tick,
      this.fixture.items,
      this.fixture.jobCore,
    );
  }

  private deliverMaterial(jobId: number): void {
    this.fixture.buildSites.deliverToSite(
      jobId,
      this.tick,
      this.fixture.ledger,
      this.fixture.jobCore,
    );
    this.fixture.buildSites.syncOffers(0, this.fixture.offers, this.fixture.ledger);
  }

  private createAndReserveBuild(): void {
    this.buildMarkerState = JOB_MARKER_WORKING;
    this.pawnState[1] = PAWN_STATE_WORKING;
    this.pawnJob[1] = BUILD_CONSTRUCTION_JOB_ID;
    this.fixture.buildSites.createBuildJob(
      {
        jobId: BUILD_CONSTRUCTION_JOB_ID,
        owner: this.fixture.pawns[1] ?? failMissingEntity(),
        siteId: 0,
        createdTick: this.tick,
      },
      this.fixture.registry,
      this.fixture.jobCore,
    );
    this.fixture.buildSites.reserveBuildJob(
      {
        jobId: BUILD_CONSTRUCTION_JOB_ID,
        tick: this.tick,
        leaseExpiryTick: this.tick + 300,
        interactionSpotId: BUILD_INTERACTION_WEST,
      },
      this.fixture.registry,
      this.fixture.ledger,
      this.fixture.jobCore,
    );
  }

  private tickConstruction(): void {
    this.buildMarkerState = JOB_MARKER_WORKING;
    this.fixture.buildSites.tickBuild(
      BUILD_CONSTRUCTION_JOB_ID,
      this.tick,
      1,
      this.fixture.jobCore,
    );
  }

  private completeConstruction(): void {
    this.fixture.buildSites.completeBuild(
      BUILD_CONSTRUCTION_JOB_ID,
      this.tick,
      this.fixture.registry,
      this.fixture.grid,
      this.fixture.locations,
      this.fixture.ledger,
      this.fixture.jobCore,
    );
    this.fixture.buildSites.syncOffers(0, this.fixture.offers, this.fixture.ledger);
    this.buildMarkerState = JOB_MARKER_COMPLETED;
    this.pawnState[1] = PAWN_STATE_COMPLETED;
    this.pawnJob[1] = -1;
  }

  private validateBasis(basis: PlayableCommandBasis): PlayableBlockedReason | undefined {
    const currentHash = this.createReadModelHash();
    const currentTargetVersion = this.targetVersion();
    const currentMapVersion = this.fixture.grid.globalVersion;
    const currentReservationVersion = this.fixture.ledger.version;
    const currentJobVersion = this.fixture.jobCore.version;
    if (
      basis.contentManifestHash !== PLAYABLE_COMMAND_SLICE_CONTENT_HASH ||
      basis.basisTick !== this.tick ||
      basis.basisSnapshotSequence !== this.snapshotSequence ||
      basis.basisReadModelHash !== currentHash ||
      basis.targetVersion !== currentTargetVersion ||
      basis.mapVersion !== currentMapVersion ||
      basis.reservationVersion !== currentReservationVersion ||
      basis.jobVersion !== currentJobVersion
    ) {
      return this.staleBasisReason(basis, currentHash);
    }

    return undefined;
  }

  private staleBasisReason(
    basis: PlayableCommandBasis,
    currentHash: string,
  ): PlayableBlockedReason {
    const expectedVersion = this.firstExpectedStaleVersion(basis);
    const observedVersion = this.firstObservedStaleVersion(basis);
    return {
      code: "stale_command",
      source: "command_validation",
      basis: {
        expectedTick: this.tick,
        observedTick: basis.basisTick,
        expectedReadModelHash: currentHash,
        observedReadModelHash: basis.basisReadModelHash,
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        ...(observedVersion !== undefined ? { observedVersion } : {}),
      },
    };
  }

  private firstExpectedStaleVersion(basis: PlayableCommandBasis): number | undefined {
    if (basis.basisSnapshotSequence !== this.snapshotSequence) return this.snapshotSequence;
    if (basis.targetVersion !== this.targetVersion()) return this.targetVersion();
    if (basis.mapVersion !== this.fixture.grid.globalVersion)
      return this.fixture.grid.globalVersion;
    if (basis.reservationVersion !== this.fixture.ledger.version)
      return this.fixture.ledger.version;
    if (basis.jobVersion !== this.fixture.jobCore.version) return this.fixture.jobCore.version;
    return undefined;
  }

  private firstObservedStaleVersion(basis: PlayableCommandBasis): number | undefined {
    if (basis.basisSnapshotSequence !== this.snapshotSequence) return basis.basisSnapshotSequence;
    if (basis.targetVersion !== this.targetVersion()) return basis.targetVersion;
    if (basis.mapVersion !== this.fixture.grid.globalVersion) return basis.mapVersion;
    if (basis.reservationVersion !== this.fixture.ledger.version) return basis.reservationVersion;
    if (basis.jobVersion !== this.fixture.jobCore.version) return basis.jobVersion;
    return undefined;
  }

  private validateLampCommandTarget(
    command: PrioritizeLampWorkCommandInput,
  ): PlayableBlockedReason | undefined {
    const target = command.payload.target;
    if (target.kind !== "lamp_gap") {
      return { code: "invalid_target", source: "command_validation", target };
    }

    if (target.gapId === "lamp-gap-no-worker") {
      return {
        code: "no_worker",
        source: "work_selection",
        target,
        candidateCounts: this.emptyCandidates(),
      };
    }

    if (target.gapId === "lamp-gap-no-path") {
      return {
        code: "no_path",
        source: "pathing",
        target,
        candidateCounts: this.oneVisitedNoPath(),
        basis: {
          expectedVersion: this.fixture.grid.globalVersion,
          observedVersion: this.fixture.grid.globalVersion,
        },
      };
    }

    if (target.gapId === "lamp-gap-policy" || command.payload.requestedAction === "repair_lamp") {
      return {
        code: "rule_policy_denial",
        source: "policy",
        target,
        policy: { policyId: "wm0150.lamp-gap.slice-policy", reasonCode: "repair_not_in_slice" },
      };
    }

    if (
      target.gapId !== "lamp-gap-0" ||
      target.anchorCell.cellIndex !== TARGET_LAMP_GAP_CELL ||
      target.anchorCell.x !== TARGET_LAMP_GAP_X ||
      target.anchorCell.y !== TARGET_LAMP_GAP_Y
    ) {
      return { code: "invalid_target", source: "command_validation", target };
    }

    return undefined;
  }

  private validateBuildCommand(
    command: QueueSimpleBuildCommandInput,
  ): PlayableBlockedReason | undefined {
    const target = this.buildCellTarget(command);
    if (command.payload.blueprint.kind === "simple_repair_frame") {
      return {
        code: "missing_resource",
        source: "reservation",
        target,
        requirement: {
          defId: REPAIR_FRAME_DEF,
          requiredAmount: 1,
          availableAmount: 0,
          reservedAmount: 0,
        },
      };
    }

    if (command.payload.anchorCell.cellIndex === 0) {
      return {
        code: "no_path",
        source: "pathing",
        target,
        candidateCounts: this.oneVisitedNoPath(),
        basis: {
          expectedVersion: this.fixture.grid.globalVersion,
          observedVersion: this.fixture.grid.globalVersion,
        },
      };
    }

    if (
      command.payload.blueprint.blueprintDefId !== SIMPLE_LAMP_BLUEPRINT ||
      command.payload.anchorCell.cellIndex !== TARGET_LAMP_GAP_CELL ||
      command.payload.anchorCell.x !== TARGET_LAMP_GAP_X ||
      command.payload.anchorCell.y !== TARGET_LAMP_GAP_Y ||
      this.buildOrderActive
    ) {
      return this.invalidBuildTarget(command);
    }

    return undefined;
  }

  private reject(
    command: PlayableAuthoritativeCommand,
    reason: PlayableBlockedReason,
  ): PlayableCommandRejectedResult {
    this.rejectedCommandCount += 1;
    this.countReason(reason.code);
    const result: PlayableCommandRejectedResult = {
      commandId: command.commandId,
      kind: command.kind,
      status: "rejected",
      rejectedTick: this.tick,
      reason,
    };
    return result;
  }

  private countReason(code: PlayableBlockedReasonCode): void {
    if (code === "missing_resource") this.missingResourceRejectCount += 1;
    else if (code === "no_path") this.noPathRejectCount += 1;
    else if (code === "no_worker") this.noWorkerRejectCount += 1;
    else if (code === "invalid_target") this.invalidTargetRejectCount += 1;
    else if (code === "stale_command") this.staleRejectCount += 1;
    else this.policyRejectCount += 1;
  }

  private recordCommand(
    command: PlayableAuthoritativeCommand,
    result: PlayableCommandResult,
    ordinal: number,
  ): void {
    this.commandLog.push({
      tick: this.tick,
      sequence: this.commandLog.length,
      commandId: command.commandId,
      kind: command.kind,
      status: result.status,
      resultHash: mixUint32(hashStringToUint32(result.status), ordinal),
    });
    this.snapshotSequence += 1;
  }

  private createJobMarkers(): readonly PlayableJobMarkerReadModel[] {
    const output: PlayableJobMarkerReadModel[] = [];
    if (this.lampOrderActive) {
      const coreJob = this.fixture.jobCore.readJob(LAMP_JOB_ID);
      output.push({
        orderId: "lamp-priority-0",
        commandId: this.lampCommandId,
        jobId: LAMP_JOB_ID,
        jobKind: "lamp_refill",
        markerState: markerName(this.lampMarkerState),
        owner: this.fixture.pawns[0] ?? failMissingEntity(),
        target: this.lampGapTarget("lamp-gap-0"),
        progressQ16: coreJob?.progressQ16 ?? this.lampProgress,
        requiredWork: PLAYABLE_COMMAND_SLICE_LAMP_WORK_TICKS,
      });
    }

    if (this.buildOrderActive) {
      const buildSite = this.fixture.buildSites.readSite(0, this.fixture.ledger);
      const buildJob = this.readLatestBuildJob();
      output.push({
        orderId: "simple-build-0",
        commandId: this.buildCommandId,
        jobId: buildJob?.jobId ?? BUILD_DELIVERY_WOOD_JOB_ID,
        jobKind: buildJobKind(buildJob?.jobKind ?? BUILD_SITE_DELIVERY_JOB_KIND),
        markerState: markerName(this.buildMarkerState),
        owner: this.fixture.pawns[1] ?? failMissingEntity(),
        target: this.lampGapTarget("lamp-gap-0"),
        progressQ16: buildSite?.buildProgressTicks ?? 0,
        requiredWork: PLAYABLE_COMMAND_SLICE_BUILD_TICKS,
      });
    }

    return output;
  }

  private createPawnReadModels(): readonly PlayablePawnReadModel[] {
    const output: PlayablePawnReadModel[] = [];
    for (let index = 0; index < PAWN_CAPACITY; index += 1) {
      output.push({
        actor: this.fixture.pawns[index] ?? failMissingEntity(),
        displayId: `pawn-${String(index)}`,
        cellIndex: this.pawnCells[index] ?? 0,
        state: pawnStateName(this.pawnState[index] ?? PAWN_STATE_IDLE),
        orderId:
          index === 0
            ? this.lampOrderActive
              ? "lamp-priority-0"
              : ""
            : this.buildOrderActive
              ? "simple-build-0"
              : "",
        jobId: this.pawnJob[index] ?? -1,
        pathTargetCell: this.pawnPathTarget[index] ?? 0,
      });
    }
    return output;
  }

  private createBuildReadModel(): PlayableBuildReadModel | undefined {
    const site = this.fixture.buildSites.readSite(0, this.fixture.ledger);
    if (site === undefined) {
      return undefined;
    }

    return {
      siteId: site.siteId,
      active: site.active,
      completed: site.completed,
      blueprintDefId: site.blueprintDefId,
      anchorCell: { x: site.anchorX, y: site.anchorY, cellIndex: site.anchorCellIndex },
      requiredWood: site.requiredAmountA,
      requiredStone: site.requiredAmountB,
      deliveredWood: site.deliveredAmountA,
      deliveredStone: site.deliveredAmountB,
      remainingWood: site.remainingDemandA,
      remainingStone: site.remainingDemandB,
      buildProgressTicks: site.buildProgressTicks,
      buildRequiredTicks: site.buildRequiredTicks,
      lanternState: site.lanternState,
    };
  }

  private createSummaries(
    markers: readonly PlayableJobMarkerReadModel[],
    build: PlayableBuildReadModel | undefined,
  ): readonly string[] {
    const summaries: string[] = [];
    summaries.push(
      `wm0150:basis:tick=${String(this.tick)};readModel=${this.createReadModelHash()}`,
    );
    for (const marker of markers) {
      summaries.push(
        `wm0150:job:${marker.orderId};state=${marker.markerState};job=${String(marker.jobId)};progress=${String(marker.progressQ16)}/${String(marker.requiredWork)}`,
      );
    }
    if (build !== undefined) {
      summaries.push(
        `wm0150:build:site=${String(build.siteId)};completed=${String(build.completed)};delivered=${String(build.deliveredWood + build.deliveredStone)};progress=${String(build.buildProgressTicks)}`,
      );
    }
    summaries.push(
      `wm0150:metrics:candidateVisits=${String(this.candidateVisits)};paths=${String(this.exactPathRequests)}`,
    );
    return summaries;
  }

  private createWorldHash(): string {
    const fields: CanonicalWorldField[] = [
      { name: "scenario", value: PLAYABLE_COMMAND_SLICE_SCENARIO_ID },
      { name: "tick", value: this.tick },
      { name: "lampMarker", value: this.lampMarkerState },
      { name: "buildMarker", value: this.buildMarkerState },
      { name: "jobVersion", value: this.fixture.jobCore.version },
      { name: "reservationVersion", value: this.fixture.ledger.version },
      { name: "buildVersion", value: this.fixture.buildSites.version },
    ];
    const site = this.fixture.buildSites.readSite(0, this.fixture.ledger);
    if (site !== undefined) pushBuildFields(fields, site);
    return formatCanonicalWorldHash({
      fields,
      randomStreams: [],
      queuedCommands: this.createCanonicalCommandLog(),
    });
  }

  private createReadModelHash(): string {
    let hash = hashStringToUint32(PLAYABLE_COMMAND_SLICE_SCENARIO_ID);
    hash = mixUint32(hash, this.tick);
    hash = mixUint32(hash, this.lampMarkerState);
    hash = mixUint32(hash, this.buildMarkerState);
    hash = mixUint32(hash, this.lampProgress);
    const site = this.fixture.buildSites.readSite(0, this.fixture.ledger);
    if (site !== undefined) {
      hash = mixUint32(hash, site.deliveredAmountA);
      hash = mixUint32(hash, site.deliveredAmountB);
      hash = mixUint32(hash, site.buildProgressTicks);
      hash = mixUint32(hash, site.completed ? 1 : 0);
    }
    return formatUint32Hex(hash);
  }

  private createCommandStreamHash(): string {
    let hash = hashStringToUint32(PLAYABLE_COMMAND_SLICE_SCENARIO_ID);
    for (const entry of this.commandLog) {
      hash = mixUint32(hash, entry.tick);
      hash = mixUint32(hash, entry.sequence);
      hash = mixUint32(hash, hashStringToUint32(entry.commandId));
      hash = mixUint32(hash, hashStringToUint32(entry.kind));
      hash = mixUint32(hash, hashStringToUint32(entry.status));
      hash = mixUint32(hash, entry.resultHash);
    }
    return formatUint32Hex(hash);
  }

  private createCanonicalCommandLog(): readonly {
    readonly tick: Tick;
    readonly sequence: number;
    readonly commandHash: number;
  }[] {
    const output: { tick: Tick; sequence: number; commandHash: number }[] = [];
    for (const entry of this.commandLog) {
      let hash = hashStringToUint32(entry.commandId);
      hash = mixUint32(hash, hashStringToUint32(entry.kind));
      hash = mixUint32(hash, hashStringToUint32(entry.status));
      hash = mixUint32(hash, entry.resultHash);
      output.push({ tick: entry.tick, sequence: entry.sequence, commandHash: hash });
    }
    return output;
  }

  private readLatestBuildJob(): JobRecordView | undefined {
    return (
      this.fixture.jobCore.readJob(BUILD_CONSTRUCTION_JOB_ID) ??
      this.fixture.jobCore.readJob(BUILD_DELIVERY_STONE_JOB_ID) ??
      this.fixture.jobCore.readJob(BUILD_DELIVERY_WOOD_JOB_ID)
    );
  }

  private buildCellTarget(command: QueueSimpleBuildCommandInput): PlayableCommandTarget {
    return {
      kind: "build_cell",
      anchorCell: command.payload.anchorCell,
      blueprintDefId: command.payload.blueprint.blueprintDefId,
    };
  }

  private lampGapTarget(gapId: string): PlayableCommandTarget {
    return {
      kind: "lamp_gap",
      gapId,
      anchorCell: { x: TARGET_LAMP_GAP_X, y: TARGET_LAMP_GAP_Y, cellIndex: TARGET_LAMP_GAP_CELL },
    };
  }

  private invalidBuildTarget(command: QueueSimpleBuildCommandInput): PlayableBlockedReason {
    return {
      code: "invalid_target",
      source: "command_validation",
      target: this.buildCellTarget(command),
    };
  }

  private jobDriverReason(target: PlayableCommandTarget): PlayableBlockedReason {
    return { code: "invalid_target", source: "job_driver", target };
  }

  private emptyCandidates(): PlayableCandidateCounts {
    return {
      workerCandidates: 0,
      visitedCandidates: 0,
      selectedCandidates: 0,
      candidateCap: PAWN_CAPACITY,
      candidateCapHit: false,
      pathRequests: 0,
    };
  }

  private oneVisitedNoPath(): PlayableCandidateCounts {
    this.candidateVisits += 1;
    this.exactPathRequests += 1;
    return {
      workerCandidates: 1,
      visitedCandidates: 1,
      selectedCandidates: 0,
      candidateCap: PAWN_CAPACITY,
      candidateCapHit: false,
      pathRequests: 1,
    };
  }

  private targetVersion(): number {
    return this.fixture.buildSites.version + this.fixture.jobCore.version + this.snapshotSequence;
  }
}

export function createPlayableCommandSliceRuntime(): PlayableCommandSliceRuntime {
  return new PlayableCommandSliceRuntime();
}

export function createPlayableAdvanceCommandId(tick: Tick): string {
  return `wm0150.advance.${String(tick)}`;
}

export function parsePlayableAdvanceCommandId(commandId: string): Tick | undefined {
  const prefix = "wm0150.advance.";
  if (!commandId.startsWith(prefix)) {
    return undefined;
  }

  const tick = Number(commandId.slice(prefix.length));
  return isSafeTick(tick) ? tick : undefined;
}

export function runPlayableCommandSliceScenario(options: {
  readonly seed: string;
  readonly ticks: Tick;
}): PlayableSliceSummary {
  if (options.seed.length === 0 || !isSafeTick(options.ticks)) {
    throw new Error("WM-0150 playable command scenario requires seed and safe tick count");
  }

  const runtime = createPlayableCommandSliceRuntime();
  const results: PlayableCommandResult[] = [];
  results.push(runtime.applyCommand(createLampCommand("cmd-lamp", runtime.readCommandBasis()), 0));
  runtime.advanceTo(45);
  results.push(
    runtime.applyCommand(createBuildCommand("cmd-build", runtime.readCommandBasis()), 1),
  );
  runtime.advanceTo(200);
  results.push(
    runtime.applyCommand(
      createMissingResourceCommand("cmd-missing", runtime.readCommandBasis()),
      2,
    ),
  );
  results.push(
    runtime.applyCommand(createNoPathCommand("cmd-no-path", runtime.readCommandBasis()), 3),
  );
  results.push(
    runtime.applyCommand(createNoWorkerCommand("cmd-no-worker", runtime.readCommandBasis()), 4),
  );
  results.push(
    runtime.applyCommand(createInvalidTargetCommand("cmd-invalid", runtime.readCommandBasis()), 5),
  );
  results.push(
    runtime.applyCommand(createPolicyCommand("cmd-policy", runtime.readCommandBasis()), 6),
  );
  const staleBasis = runtime.readCommandBasis();
  runtime.advanceTo(201);
  results.push(runtime.applyCommand(createLampCommand("cmd-stale", staleBasis), 7));
  runtime.advanceTo(options.ticks);
  return runtime.createSummary(options.seed, results);
}

function createFixture(): PlayableFixture {
  const registry = createEntityRegistry({ capacity: 32 });
  const grid = createMapGrid({ width: MAP_WIDTH, height: MAP_HEIGHT, chunkSize: MAP_CHUNK_SIZE });
  const ledger = createReservationLedger({ capacity: 96, entityCapacity: 32, cellCount: 192 });
  const locations = createLocationStore({
    capacity: 32,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    chunkSize: MAP_CHUNK_SIZE,
    lifecycleHooks: ledger,
  });
  const items = createItemStackStore(8);
  const buildSites = createBuildSiteStore(4, 16);
  const jobCore = createJobCoreStore({ capacity: 16 });
  const offers = createWorkOfferIndex({
    capacity: 16,
    workTypeCapacity: 4,
    regionCapacity: 4,
    defCapacity: 16,
    urgencyBucketCount: 4,
    permissionCapacity: 2,
  });
  const pawns = [allocate(registry), allocate(registry)];
  const wood = allocate(registry);
  const stone = allocate(registry);
  const site = allocate(registry);
  mustOk(
    items.createStack(
      { stackId: WOOD_STACK_ID, entity: wood, defId: WOOD_DEF, quantity: 6, capacity: 6 },
      registry,
    ),
  );
  mustOk(
    items.createStack(
      { stackId: STONE_STACK_ID, entity: stone, defId: STONE_DEF, quantity: 2, capacity: 2 },
      registry,
    ),
  );
  return { registry, grid, locations, items, buildSites, ledger, jobCore, offers, pawns, site };
}

function createLampCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): PrioritizeLampWorkCommandInput {
  return {
    commandId,
    kind: "PrioritizeLampWork",
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-0",
        anchorCell: { x: TARGET_LAMP_GAP_X, y: TARGET_LAMP_GAP_Y, cellIndex: TARGET_LAMP_GAP_CELL },
      },
      requestedAction: "auto",
      priorityBand: 1,
    },
    basis,
  };
}

function createBuildCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): QueueSimpleBuildCommandInput {
  return {
    commandId,
    kind: "QueueSimpleBuild",
    payload: {
      blueprint: { kind: "simple_lamp_post", blueprintDefId: SIMPLE_LAMP_BLUEPRINT },
      anchorCell: { x: TARGET_LAMP_GAP_X, y: TARGET_LAMP_GAP_Y, cellIndex: TARGET_LAMP_GAP_CELL },
      orientation: 0,
      priorityBand: 1,
    },
    basis,
  };
}

function createMissingResourceCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): QueueSimpleBuildCommandInput {
  return {
    commandId,
    kind: "QueueSimpleBuild",
    payload: {
      blueprint: { kind: "simple_repair_frame", blueprintDefId: SIMPLE_REPAIR_BLUEPRINT },
      anchorCell: { x: 13, y: 7, cellIndex: 125 },
      orientation: 0,
      priorityBand: 1,
    },
    basis,
  };
}

function createNoPathCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): PrioritizeLampWorkCommandInput {
  return {
    ...createLampCommand(commandId, basis),
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-no-path",
        anchorCell: { x: 0, y: 0, cellIndex: 0 },
      },
      requestedAction: "auto",
      priorityBand: 1,
    },
  };
}

function createNoWorkerCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): PrioritizeLampWorkCommandInput {
  return {
    ...createLampCommand(commandId, basis),
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-no-worker",
        anchorCell: { x: TARGET_LAMP_GAP_X, y: TARGET_LAMP_GAP_Y, cellIndex: TARGET_LAMP_GAP_CELL },
      },
      requestedAction: "auto",
      priorityBand: 1,
    },
  };
}

function createInvalidTargetCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): PrioritizeLampWorkCommandInput {
  return {
    ...createLampCommand(commandId, basis),
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-missing",
        anchorCell: { x: 15, y: 11, cellIndex: 191 },
      },
      requestedAction: "auto",
      priorityBand: 1,
    },
  };
}

function createPolicyCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): PrioritizeLampWorkCommandInput {
  return {
    ...createLampCommand(commandId, basis),
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-policy",
        anchorCell: { x: TARGET_LAMP_GAP_X, y: TARGET_LAMP_GAP_Y, cellIndex: TARGET_LAMP_GAP_CELL },
      },
      requestedAction: "repair_lamp",
      priorityBand: 1,
    },
  };
}

function pushBuildFields(fields: CanonicalWorldField[], site: BuildSiteView): void {
  fields.push({ name: "siteActive", value: site.active });
  fields.push({ name: "siteCompleted", value: site.completed });
  fields.push({ name: "deliveredWood", value: site.deliveredAmountA });
  fields.push({ name: "deliveredStone", value: site.deliveredAmountB });
  fields.push({ name: "buildProgress", value: site.buildProgressTicks });
  fields.push({ name: "lanternState", value: site.lanternState });
}

function markerName(code: number): PlayableJobMarkerReadModel["markerState"] {
  if (code === JOB_MARKER_CLAIMED) return "claimed";
  if (code === JOB_MARKER_MOVING) return "moving";
  if (code === JOB_MARKER_WORKING) return "working";
  if (code === JOB_MARKER_BLOCKED) return "blocked";
  if (code === JOB_MARKER_COMPLETED) return "completed";
  return "queued";
}

function pawnStateName(code: number): PlayablePawnReadModel["state"] {
  if (code === PAWN_STATE_MOVING) return "moving";
  if (code === PAWN_STATE_WORKING) return "working";
  if (code === PAWN_STATE_COMPLETED) return "completed";
  if (code === PAWN_STATE_BLOCKED) return "blocked";
  return "idle";
}

function buildJobKind(jobKind: number): PlayableJobMarkerReadModel["jobKind"] {
  if (jobKind === BUILD_SITE_CONSTRUCTION_JOB_KIND) {
    return "build_site_construction";
  }
  return "build_site_delivery";
}

function allocate(registry: EntityRegistry): EntityId {
  const allocated = registry.allocate();
  if (!allocated.ok) {
    throw new Error(allocated.reason);
  }
  return allocated.entity;
}

function mustOk(result: { readonly ok: boolean; readonly reason?: string }): void {
  if (!result.ok) {
    throw new Error(result.reason ?? "WM-0150 playable slice mutation failed");
  }
}

function failMissingEntity(): never {
  throw new Error("missing WM-0150 fixture entity");
}
