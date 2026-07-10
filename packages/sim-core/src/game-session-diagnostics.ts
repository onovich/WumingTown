import type { GameSessionCommandQueue } from "./game-session-command-queue";
import type {
  GameSessionOwnerGraph,
  GameSessionScenarioReferences,
} from "./game-session-initializer";
import type {
  GameSessionConservationDivergence,
  GameSessionConservationReport,
} from "./game-session-types";
import type { Tick } from "./time";

export class GameSessionDiagnostics {
  private readonly owners: GameSessionOwnerGraph;
  private readonly references: GameSessionScenarioReferences;
  private readonly commandQueue: GameSessionCommandQueue;
  private readonly initialResourceQuantities: Uint32Array;
  private firstDivergenceValue: GameSessionConservationDivergence | null = null;

  constructor(
    owners: GameSessionOwnerGraph,
    references: GameSessionScenarioReferences,
    commandQueue: GameSessionCommandQueue,
  ) {
    this.owners = owners;
    this.references = references;
    this.commandQueue = commandQueue;
    this.initialResourceQuantities = this.captureInitialResourceQuantities();
  }

  auditTransientLeaks(tick: Tick): void {
    if (this.firstDivergenceValue !== null) return;
    if (this.owners.jobs.activeJobCount > 0) {
      this.firstDivergenceValue = createDivergence(
        "game_session.jobs_leaked",
        tick,
        this.owners.jobs.activeJobCount,
      );
    } else if (this.owners.reservations.activeCount > 0) {
      this.firstDivergenceValue = createDivergence(
        "game_session.reservations_leaked",
        tick,
        this.owners.reservations.activeCount,
      );
    } else if (this.owners.pathRequests.queuedCount > 0) {
      this.firstDivergenceValue = createDivergence(
        "game_session.path_queue_leaked",
        tick,
        this.owners.pathRequests.queuedCount,
      );
    }
  }

  createReport(tick: Tick): GameSessionConservationReport {
    const resources = [];
    let divergence = this.firstDivergenceValue;
    for (let slot = 0; slot < this.references.resourceStackIds.length; slot += 1) {
      const stackId = this.references.resourceStackIds[slot];
      const stack = stackId === undefined ? undefined : this.owners.items.readStack(stackId);
      const initial = this.initialResourceQuantities[slot] ?? 0;
      const current = stack?.quantity ?? 0;
      resources.push({ defId: stack?.defId ?? 0, initial, current, delta: current - initial });
      if (divergence === null && current !== initial) {
        divergence = {
          code: "game_session.resource_conservation_failed",
          tick,
          subjectId: stack?.defId ?? slot,
          expected: initial,
          actual: current,
        };
        this.firstDivergenceValue = divergence;
      }
    }

    divergence = divergence ?? this.createTerminalLeakDivergence(tick);
    const needMetrics = this.owners.needUrgency.createMetrics();
    const restMetrics = this.owners.restCandidates.createMetrics(this.owners.restFixtures);
    const storageMetrics = this.owners.storage.createMetrics();
    const environmentMetrics = this.owners.environment.createMetrics();
    const workMetrics = this.owners.workOffers.createMetrics();
    return {
      ok:
        divergence === null &&
        this.owners.map.dirtyChunkCount === 0 &&
        this.owners.lamps.dirtyBacklog === 0 &&
        needMetrics.dirtyBacklog === 0 &&
        restMetrics.dirtyBacklog === 0 &&
        storageMetrics.dirtyBacklog === 0 &&
        environmentMetrics.dirtyBacklog === 0 &&
        workMetrics.backlogCount === 0,
      tick,
      activeJobs: this.owners.jobs.activeJobCount,
      activeReservations: this.owners.reservations.activeCount,
      pendingCommands: this.commandQueue.pendingCount,
      pendingPaths: this.owners.pathRequests.queuedCount,
      mapDirtyBacklog: this.owners.map.dirtyChunkCount,
      lampDirtyBacklog: this.owners.lamps.dirtyBacklog,
      needDirtyBacklog: needMetrics.dirtyBacklog,
      restDirtyBacklog: restMetrics.dirtyBacklog,
      storageDirtyBacklog: storageMetrics.dirtyBacklog,
      environmentDirtyBacklog: environmentMetrics.dirtyBacklog,
      workOfferBacklog: workMetrics.backlogCount,
      resources,
      firstDivergence: divergence,
    };
  }

  readResourceConservationDelta(): number {
    let absoluteDelta = 0;
    for (let slot = 0; slot < this.references.resourceStackIds.length; slot += 1) {
      const stackId = this.references.resourceStackIds[slot];
      const current =
        stackId === undefined ? 0 : (this.owners.items.readStack(stackId)?.quantity ?? 0);
      absoluteDelta += Math.abs(current - (this.initialResourceQuantities[slot] ?? 0));
    }
    return absoluteDelta;
  }

  private createTerminalLeakDivergence(tick: Tick): GameSessionConservationDivergence | null {
    if (this.owners.jobs.activeJobCount > 0) {
      return createDivergence("game_session.jobs_leaked", tick, this.owners.jobs.activeJobCount);
    }
    if (this.owners.reservations.activeCount > 0) {
      return createDivergence(
        "game_session.reservations_leaked",
        tick,
        this.owners.reservations.activeCount,
      );
    }
    if (this.owners.pathRequests.queuedCount > 0) {
      return createDivergence(
        "game_session.path_queue_leaked",
        tick,
        this.owners.pathRequests.queuedCount,
      );
    }
    const nextPendingTick = this.commandQueue.nextPendingTick;
    if (nextPendingTick !== undefined && nextPendingTick <= tick) {
      return createDivergence(
        "game_session.command_queue_not_drained",
        tick,
        this.commandQueue.pendingCount,
      );
    }
    return null;
  }

  private captureInitialResourceQuantities(): Uint32Array {
    const quantities = new Uint32Array(this.references.resourceStackIds.length);
    for (let slot = 0; slot < this.references.resourceStackIds.length; slot += 1) {
      const stackId = this.references.resourceStackIds[slot];
      quantities[slot] =
        stackId === undefined ? 0 : (this.owners.items.readStack(stackId)?.quantity ?? 0);
    }
    return quantities;
  }
}

function createDivergence(
  code: GameSessionConservationDivergence["code"],
  tick: Tick,
  actual: number,
): GameSessionConservationDivergence {
  return { code, tick, subjectId: 0, expected: 0, actual };
}
