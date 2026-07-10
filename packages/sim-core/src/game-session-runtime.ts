import { GameSessionCommandQueue } from "./game-session-command-queue";
import { createPr1IntegratedGameSessionDefinition } from "./game-session-definition";
import { GameSessionDiagnostics } from "./game-session-diagnostics";
import {
  createGameSessionCanonicalHashInput,
  createGameSessionReadModelHash,
  createGameSessionWorldHash,
  type GameSessionHashContext,
} from "./game-session-hash";
import {
  initializeGameSessionOwnerGraph,
  type GameSessionInitializationReason,
  type GameSessionOwnerGraph,
  type GameSessionScenarioReferences,
} from "./game-session-initializer";
import {
  buildGameSessionRenderProjection,
  buildGameSessionUiProjection,
} from "./game-session-projection";
import { GameSessionTickCoordinator } from "./game-session-tick";
import {
  GAME_SESSION_COMMAND_QUEUE_CAPACITY,
  GAME_SESSION_PROJECTION_BASIS_VERSION,
  type GameSessionAdvanceResult,
  type GameSessionCommandInput,
  type GameSessionConservationCheckpoint,
  type GameSessionConservationReport,
  type GameSessionDerivedIndexBasis,
  type GameSessionMetrics,
  type GameSessionPhase,
  type GameSessionProjectionBasis,
  type GameSessionQueueCommandResult,
  type GameSessionRenderProjection,
  type GameSessionRuntimeOptions,
  type GameSessionScenarioDefinition,
  type GameSessionUiProjection,
} from "./game-session-types";
import { createNamedRandomStreams, type NamedRandomStreams } from "./deterministic-rng";
import { createPathVersionBasis, type PathVersionBasis } from "./pathing";
import { isSafeTick, type RunnerSpeed, type Tick } from "./time";
import type { CanonicalWorldHashInput } from "./world-hash";

export type GameSessionRuntimeInitializationResult =
  | { readonly ok: true; readonly runtime: GameSessionRuntime }
  | {
      readonly ok: false;
      readonly reason: GameSessionInitializationReason;
      readonly stageIndex: number;
    };

export class GameSessionRuntime {
  readonly seed: string;
  readonly seedHash: number;
  readonly definition: GameSessionScenarioDefinition;
  readonly owners: GameSessionOwnerGraph;
  readonly references: GameSessionScenarioReferences;
  readonly randomStreams: NamedRandomStreams;

  private readonly commandQueue: GameSessionCommandQueue;
  private readonly diagnostics: GameSessionDiagnostics;
  private readonly tickCoordinator: GameSessionTickCoordinator;
  private currentTick: Tick = 0;
  private pausedValue = false;
  private requestedSpeedValue: RunnerSpeed = 1;
  private ticksAdvanced = 0;
  private projectionBuildCount = 0;
  private derivedIndexVersion = 1;
  private pathBasis: PathVersionBasis;
  private derivedBasis: GameSessionDerivedIndexBasis;

  private constructor(
    seed: string,
    definition: GameSessionScenarioDefinition,
    owners: GameSessionOwnerGraph,
    references: GameSessionScenarioReferences,
  ) {
    this.seed = seed;
    this.definition = definition;
    this.owners = owners;
    this.references = references;
    this.randomStreams = createNamedRandomStreams({ seed });
    this.seedHash = this.randomStreams.seedHash;
    this.commandQueue = new GameSessionCommandQueue(
      GAME_SESSION_COMMAND_QUEUE_CAPACITY,
      this.seedHash,
    );
    this.pathBasis = this.createCurrentPathBasis();
    this.derivedBasis = this.captureDerivedBasis();
    this.diagnostics = new GameSessionDiagnostics(owners, references, this.commandQueue);
    this.tickCoordinator = new GameSessionTickCoordinator(
      owners,
      this.commandQueue,
      this.randomStreams,
      this.pathBasis,
    );
  }

  static initialize(options: GameSessionRuntimeOptions): GameSessionRuntimeInitializationResult {
    if (options.seed.length === 0) {
      return { ok: false, reason: "game_session.scenario_invalid", stageIndex: 0 };
    }

    const initialized = initializeGameSessionOwnerGraph(
      options.scenario ?? createPr1IntegratedGameSessionDefinition(),
    );
    if (!initialized.ok) return initialized;
    return {
      ok: true,
      runtime: new GameSessionRuntime(
        options.seed,
        initialized.definition,
        initialized.owners,
        initialized.references,
      ),
    };
  }

  get tick(): Tick {
    return this.currentTick;
  }

  get paused(): boolean {
    return this.pausedValue;
  }

  get requestedSpeed(): RunnerSpeed {
    return this.requestedSpeedValue;
  }

  get indexBasis(): GameSessionDerivedIndexBasis {
    return this.derivedBasis;
  }

  setPaused(paused: boolean): void {
    this.pausedValue = paused;
  }

  setRequestedSpeed(speed: RunnerSpeed): void {
    this.requestedSpeedValue = speed;
  }

  queueCommand(input: GameSessionCommandInput): GameSessionQueueCommandResult {
    return this.commandQueue.queue(input, this.currentTick);
  }

  advanceTicks(requestedTicks: Tick): GameSessionAdvanceResult {
    if (!isSafeTick(requestedTicks)) {
      throw new Error("game session requested ticks must be a non-negative safe integer");
    }

    if (this.pausedValue || requestedTicks === 0) {
      return {
        requestedTicks,
        advancedTicks: 0,
        finalTick: this.currentTick,
        paused: this.pausedValue,
      };
    }

    let advanced = 0;
    while (advanced < requestedTicks) {
      this.tickCoordinator.runOneTick(this.currentTick);
      this.currentTick += 1;
      this.ticksAdvanced += 1;
      advanced += 1;
    }
    this.refreshDerivedBasis();
    return {
      requestedTicks,
      advancedTicks: advanced,
      finalTick: this.currentTick,
      paused: false,
    };
  }

  rebuildDerivedIndexes(): boolean {
    for (const stackId of this.references.resourceStackIds) {
      const marked = this.owners.storage.markSlotDirty(stackId);
      if (!marked.ok) return false;
    }

    const storage = this.owners.storage.refreshDirty(
      this.owners.items,
      this.owners.reservations,
      this.owners.workOffers,
      this.references.resourceStackIds.length,
    );
    this.owners.needUrgency.rebuildFromStore(this.owners.needs);
    this.owners.restCandidates.rebuildFromStore(this.owners.restFixtures);
    const build = this.owners.buildSites.syncOffers(
      0,
      this.owners.workOffers,
      this.owners.reservations,
    );
    if (!build.ok || storage.dirtyBacklog !== 0) return false;
    this.refreshDerivedBasis();
    return true;
  }

  createCanonicalWorldHashInput(): CanonicalWorldHashInput {
    return createGameSessionCanonicalHashInput(this.createHashContext());
  }

  createWorldHash(): string {
    return createGameSessionWorldHash(this.createHashContext());
  }

  createReadModelHash(): string {
    return createGameSessionReadModelHash(this.createHashContext());
  }

  createRenderProjection(): GameSessionRenderProjection {
    this.projectionBuildCount += 1;
    return buildGameSessionRenderProjection(this.createProjectionContext());
  }

  createUiProjection(): GameSessionUiProjection {
    this.projectionBuildCount += 1;
    return buildGameSessionUiProjection(this.createProjectionContext());
  }

  readLastPhaseOrder(): readonly GameSessionPhase[] {
    return this.tickCoordinator.readLastPhaseOrder();
  }

  createMetrics(): GameSessionMetrics {
    return this.tickCoordinator.createMetrics(
      this.currentTick,
      this.ticksAdvanced,
      this.projectionBuildCount,
      this.diagnostics.readResourceConservationDelta(),
    );
  }

  createConservationReport(
    checkpoint: GameSessionConservationCheckpoint = "observational",
  ): GameSessionConservationReport {
    return this.diagnostics.createReport(this.currentTick, checkpoint);
  }

  private createHashContext(): GameSessionHashContext {
    return {
      definition: this.definition,
      owners: this.owners,
      references: this.references,
      tick: this.currentTick,
      paused: this.pausedValue,
      requestedSpeed: this.requestedSpeedValue,
      commandQueue: this.commandQueue,
      randomStreams: this.randomStreams.snapshot(),
    };
  }

  private createProjectionContext(): Parameters<typeof buildGameSessionUiProjection>[0] {
    return {
      definition: this.definition,
      owners: this.owners,
      references: this.references,
      tick: this.currentTick,
      paused: this.pausedValue,
      requestedSpeed: this.requestedSpeedValue,
      basis: this.createProjectionBasis(),
    };
  }

  private createProjectionBasis(): GameSessionProjectionBasis {
    return {
      projectionBasisVersion: GAME_SESSION_PROJECTION_BASIS_VERSION,
      scenarioId: this.definition.scenarioId,
      contentManifestHash: this.definition.contentManifestHash,
      tick: this.currentTick,
      snapshotSequence: this.currentTick,
      worldHash: this.createWorldHash(),
      readModelHash: this.createReadModelHash(),
      mapVersion: this.owners.map.globalVersion,
      locationVersion: this.owners.locations.version,
      reservationVersion: this.owners.reservations.version,
      jobVersion: this.owners.jobs.version,
      derivedIndexVersion: this.derivedBasis.version,
    };
  }

  private createCurrentPathBasis(): PathVersionBasis {
    return createPathVersionBasis(this.owners.map, {
      navigationVersion: this.owners.map.globalVersion,
      regionVersion: 1,
      roomVersion: 1,
      regionGraphVersion: 1,
    });
  }

  private refreshDerivedBasis(): void {
    this.derivedIndexVersion += 1;
    this.pathBasis = this.createCurrentPathBasis();
    this.tickCoordinator.setPathBasis(this.pathBasis);
    this.derivedBasis = this.captureDerivedBasis();
  }

  private captureDerivedBasis(): GameSessionDerivedIndexBasis {
    const storage = this.owners.storage.createMetrics();
    const needs = this.owners.needUrgency.createMetrics();
    const rest = this.owners.restCandidates.createMetrics(this.owners.restFixtures);
    return {
      version: this.derivedIndexVersion,
      mapVersion: this.owners.map.globalVersion,
      locationVersion: this.owners.locations.version,
      itemVersion: this.owners.items.version,
      storageIndexVersion: storage.version,
      reservationVersion: this.owners.reservations.version,
      jobVersion: this.owners.jobs.version,
      workOfferCount: this.owners.workOffers.activeOfferCount,
      needOwnerVersion: this.owners.needs.version,
      needIndexVersion: needs.indexVersion,
      restOwnerVersion: this.owners.restFixtures.version,
      restIndexVersion: rest.version,
      lampOwnerVersion: this.owners.lamps.ownerVersion,
      buildOwnerVersion: this.owners.buildSites.version,
      pathMapVersion: this.pathBasis.mapVersion,
      pathNavigationVersion: this.pathBasis.navigationVersion,
      pathRegionVersion: this.pathBasis.regionVersion,
      pathRoomVersion: this.pathBasis.roomVersion,
      pathRegionGraphVersion: this.pathBasis.regionGraphVersion,
    };
  }
}

export function initializeGameSessionRuntime(
  options: GameSessionRuntimeOptions,
): GameSessionRuntimeInitializationResult {
  return GameSessionRuntime.initialize(options);
}
