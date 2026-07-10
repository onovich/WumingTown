import type { NamedRandomStreams } from "./deterministic-rng";
import type { GameSessionCommandQueue } from "./game-session-command-queue";
import type { GameSessionOwnerGraph } from "./game-session-initializer";
import { GameSessionJobLifecycle } from "./game-session-job-lifecycle";
import {
  GAME_SESSION_PHASE_ORDER,
  PR1_RESOURCE_WOOD,
  type GameSessionMetrics,
  type GameSessionPhase,
} from "./game-session-types";
import type { M3EnvironmentDirtyKey } from "./m3-environment-data";
import type { M4LampDirtyKeyOutput } from "./m4-lamp-network";
import type { PathVersionBasis } from "./pathing";
import type { Tick } from "./time";

const WORK_PROBE_INTERVAL_TICKS = 300;
const ENVIRONMENT_UPDATE_INTERVAL_TICKS = 1_500;

export class GameSessionTickCoordinator {
  private readonly owners: GameSessionOwnerGraph;
  private readonly commandQueue: GameSessionCommandQueue;
  private readonly randomStreams: NamedRandomStreams;
  private readonly mapDirtyScratch = new Uint32Array(1);
  private readonly workCandidateScratch = new Uint32Array(8);
  private readonly workSelectedScratch = new Uint32Array(4);
  private readonly workScoreScratch = new Int32Array(4);
  private readonly lampDirtyScratch: M4LampDirtyKeyOutput[] = [createLampDirtyOutput()];
  private readonly environmentDirtyScratch: M3EnvironmentDirtyKey[] = [];
  private readonly phaseCodes = new Uint8Array(GAME_SESSION_PHASE_ORDER.length);
  private readonly jobLifecycle: GameSessionJobLifecycle;
  private phaseCursor = 0;
  private phaseViolationCount = 0;
  private workOfferProbeCount = 0;
  private workOfferVisitedCount = 0;
  private pathRequestCount = 0;
  private nextPathRequestSequence = 0;
  private eventResultObjectCallCount = 0;
  private pathBasis: PathVersionBasis;

  constructor(
    owners: GameSessionOwnerGraph,
    commandQueue: GameSessionCommandQueue,
    randomStreams: NamedRandomStreams,
    pathBasis: PathVersionBasis,
  ) {
    this.owners = owners;
    this.commandQueue = commandQueue;
    this.randomStreams = randomStreams;
    this.pathBasis = pathBasis;
    this.jobLifecycle = new GameSessionJobLifecycle(owners);
  }

  setPathBasis(pathBasis: PathVersionBasis): void {
    this.pathBasis = pathBasis;
  }

  runOneTick(tick: Tick): void {
    this.phaseCursor = 0;
    this.enterPhase(1);
    this.commandQueue.applyForTick(tick);
    this.enterPhase(2);
    this.refreshBoundedDirtyQueues();
    this.enterPhase(3);
    this.probeIndexedWork(tick);
    this.enterPhase(4);
    this.jobLifecycle.acquireSelected(tick);
    this.enterPhase(5);
    this.jobLifecycle.advanceActive(tick);
    this.processOnePathRequest();
    this.enterPhase(6);
    this.advanceTownOwners(tick);
    this.enterPhase(7);
    this.enterPhase(8);
  }

  readLastPhaseOrder(): readonly GameSessionPhase[] {
    const phases: GameSessionPhase[] = [];
    for (const code of this.phaseCodes) {
      phases.push(GAME_SESSION_PHASE_ORDER[code - 1] ?? "apply_commands");
    }
    return phases;
  }

  createMetrics(
    tick: Tick,
    ticksAdvanced: number,
    projectionBuildCount: number,
    resourceConservationDelta: number,
  ): GameSessionMetrics {
    const pathMetrics = this.owners.pathRequests.createMetrics();
    const jobMetrics = this.owners.jobs.createMetrics();
    const reservationMetrics = this.owners.reservations.createMetrics();
    return {
      tick,
      ticksAdvanced,
      commandQueueDepth: this.commandQueue.pendingCount,
      commandBacklogPeak: this.commandQueue.backlogPeak,
      appliedCommandCount: this.commandQueue.appliedCount,
      workOfferProbeCount: this.workOfferProbeCount,
      workOfferVisitedCount: this.workOfferVisitedCount,
      pathRequestCount: this.pathRequestCount,
      pathAcceptedCount: pathMetrics.acceptedResultCount,
      pathStaleRejectedCount: pathMetrics.staleRejectedCount,
      pathNodeExpansions: pathMetrics.nodeExpansionTotal,
      activeJobCount: jobMetrics.runningCount,
      activeJobPeak: this.jobLifecycle.activePeak,
      jobTerminalCount: jobMetrics.terminalCount,
      activeReservationCount: reservationMetrics.activeCount,
      activeReservationPeak: this.jobLifecycle.reservationPeak,
      reservationAcquiredCount: reservationMetrics.acquiredCount,
      reservationReleasedCount: reservationMetrics.releasedCount,
      reservationConflictCount: reservationMetrics.conflictCount,
      resourceConservationDelta,
      projectionBuildCount,
      projectionBacklog: 0,
      phaseViolationCount: this.phaseViolationCount,
      fullWorldPawnScanCount: 0,
      unconditionalResultObjectCallCount: 0,
      needScheduledUpdateCallCount: 0,
      eventResultObjectCallCount:
        this.eventResultObjectCallCount + this.jobLifecycle.eventResultObjectCallCount,
    };
  }

  private refreshBoundedDirtyQueues(): void {
    if (this.owners.map.dirtyChunkCount > 0) {
      this.owners.map.processDirtyChunks(1, this.mapDirtyScratch);
      this.eventResultObjectCallCount += 1;
    }
    if (this.owners.lamps.dirtyBacklog > 0) {
      this.owners.lamps.processDirtyLamps(1, this.lampDirtyScratch);
      this.eventResultObjectCallCount += 1;
    }
  }

  private probeIndexedWork(tick: Tick): void {
    if (tick % WORK_PROBE_INTERVAL_TICKS !== 0) return;
    const residentId =
      Math.floor(tick / WORK_PROBE_INTERVAL_TICKS) % this.owners.residents.activeCount;
    const selected = this.owners.workOffers.selectTopOffers(
      {
        pawnId: residentId,
        workType: 1,
        regionId: 0,
        defId: PR1_RESOURCE_WOOD,
        urgencyBucket: 1,
        permissionId: 0,
        candidateCap: 8,
        maxSelectedOffers: 4,
      },
      this.workCandidateScratch,
      this.workSelectedScratch,
      this.workScoreScratch,
      this.owners.workReasonTraces,
    );
    this.eventResultObjectCallCount += 1;
    if (!selected.ok) return;
    this.workOfferProbeCount += 1;
    this.workOfferVisitedCount += selected.visitedCount;
    this.owners.residents.setIndexedWorkAvailable(residentId, selected.selectedCount > 0);
    this.eventResultObjectCallCount += 1;
    const offerId = this.workSelectedScratch[0];
    if (offerId !== undefined) this.jobLifecycle.selectCandidate(residentId, offerId);
    this.enqueueSelectedPath(residentId, tick);
  }

  private enqueueSelectedPath(residentId: number, tick: Tick): void {
    const offerId = this.workSelectedScratch[0];
    const resident = this.owners.residents.read(residentId);
    const offer = offerId === undefined ? undefined : this.owners.workOffers.readOffer(offerId);
    this.eventResultObjectCallCount += offerId === undefined ? 1 : 2;
    if (resident === undefined || offer === undefined) return;
    const location = this.owners.locations.read(resident.entity, this.owners.entities);
    this.eventResultObjectCallCount += 1;
    if (!location.ok) return;
    const enqueued = this.owners.pathRequests.enqueue({
      requestSequence: this.nextPathRequestSequence,
      issuedTick: tick,
      startCellIndex: location.location.cellIndex,
      goalCellIndex: offer.targetCellIndex,
      basis: this.pathBasis,
      maxNodeExpansions: 256,
    });
    this.eventResultObjectCallCount += 1;
    if (enqueued.ok) {
      this.pathRequestCount += 1;
      this.nextPathRequestSequence += 1;
    }
  }

  private processOnePathRequest(): void {
    if (this.owners.pathRequests.queuedCount === 0) return;
    const processed = this.owners.pathRequests.processNext(this.owners.map);
    this.eventResultObjectCallCount += 1;
    if (processed.ok && processed.processed) {
      this.owners.pathRequests.commitResult(processed.result, this.pathBasis);
      this.eventResultObjectCallCount += 1;
    }
  }

  private advanceTownOwners(tick: Tick): void {
    if (tick % ENVIRONMENT_UPDATE_INTERVAL_TICKS === 0) {
      this.owners.environment.advanceToTick(tick, this.randomStreams);
      this.eventResultObjectCallCount += 1;
      this.environmentDirtyScratch.length = 0;
      this.owners.environment.dirtyQueue.drain(16, this.environmentDirtyScratch);
    }
  }

  private enterPhase(code: number): void {
    if (code !== this.phaseCursor + 1) this.phaseViolationCount += 1;
    this.phaseCodes[this.phaseCursor] = code;
    this.phaseCursor += 1;
  }
}

function createLampDirtyOutput(): M4LampDirtyKeyOutput {
  return {
    sequence: 0,
    lampId: 0,
    groupId: 0,
    cellIndex: 0,
    roomId: 0,
    chunkIndex: 0,
    projectionKey: 0,
    lampVersion: 0,
    ownerVersion: 0,
    reason: "lamp.registered",
  };
}
