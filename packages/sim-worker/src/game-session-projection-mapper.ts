import {
  GAME_SESSION_NO_JOB,
  PR1_RESOURCE_FOOD,
  PR1_RESOURCE_LAMP_OIL,
  PR1_RESOURCE_STONE,
  PR1_RESOURCE_WOOD,
  TICKS_PER_DAY,
  type GameSessionRenderEntity,
  type GameSessionRenderProjection,
  type GameSessionRuntime,
  type GameSessionStructuredReason,
  type GameSessionUiProjection,
  type GameSessionUiResident,
} from "@wuming-town/sim-core";
import {
  GAME_SESSION_PROJECTION_VERSION,
  type GameSessionAlertV1,
  type GameSessionAnimationStateV1,
  type GameSessionDayPhaseV1,
  type GameSessionEntityRefV1,
  type GameSessionJobMarkerStateV1,
  type GameSessionProjectionBasisV1,
  type GameSessionRenderEntityV1,
  type GameSessionRenderProjectionV1,
  type GameSessionResourceKindV1,
  type GameSessionSelectionDetailV1,
  type GameSessionStructuredReasonV1,
  type GameSessionUiJobMarkerV1,
  type GameSessionUiProjectionV1,
  type GameSessionUiResidentV1,
  type GameSessionUiResourceV1,
  type UiDetailSubject,
} from "@wuming-town/sim-protocol";

export interface GameSessionProjectionPair {
  readonly render: GameSessionRenderProjectionV1;
  readonly ui: GameSessionUiProjectionV1;
}

export interface GameSessionProjectionMappingInput {
  readonly runtime: GameSessionRuntime;
  readonly snapshotSequence: number;
  readonly previousSnapshotSequence: number | null;
  readonly effectiveTicksPerSecond: 0 | 30 | 60 | 90;
  readonly selection: UiDetailSubject | null;
}

export function createGameSessionProjectionPair(
  input: GameSessionProjectionMappingInput,
): GameSessionProjectionPair {
  const coreRender = input.runtime.createRenderProjection();
  const coreUi = input.runtime.createUiProjection();
  const basis = mapBasis(coreUi, input.snapshotSequence, input.previousSnapshotSequence);
  const residents = mapResidents(input.runtime, coreUi);
  const resources = mapResources(input.runtime, coreUi);
  const jobs = mapJobs(residents);
  const alerts = mapAlerts(residents, coreUi.alerts);
  return {
    render: {
      basis,
      mapWidth: coreRender.mapWidth,
      mapHeight: coreRender.mapHeight,
      tileSizeQ16: 65_536,
      entities: mapRenderEntities(coreRender, residents),
    },
    ui: {
      basis,
      paused: coreUi.paused,
      requestedSpeed: coreUi.requestedSpeed,
      effectiveTicksPerSecond: input.effectiveTicksPerSecond,
      dayIndex: coreUi.dayIndex,
      tickOfDay: coreUi.tickOfDay,
      ticksPerDay: TICKS_PER_DAY,
      dayPhase: readDayPhase(coreUi.tickOfDay),
      daylightQ16: readDaylightQ16(coreUi.tickOfDay),
      residents,
      resources,
      jobs,
      alerts,
      selectionDetail: createSelectionDetail(
        input.runtime,
        input.selection,
        basis,
        coreUi,
        residents,
        resources,
        coreRender.entities,
      ),
      lampFuel: coreUi.lampFuel,
      lampStateCode: coreUi.lampMaintenanceState,
      buildProgressTicks: coreUi.buildProgressTicks,
      buildRequiredTicks: coreUi.buildRequiredTicks,
      buildCompleted: coreUi.buildCompleted,
    },
  };
}

function mapBasis(
  projection: GameSessionUiProjection,
  snapshotSequence: number,
  previousSnapshotSequence: number | null,
): GameSessionProjectionBasisV1 {
  return {
    projectionVersion: GAME_SESSION_PROJECTION_VERSION,
    scenarioId: projection.basis.scenarioId,
    contentManifestHash: projection.basis.contentManifestHash,
    tick: projection.basis.tick,
    snapshotSequence,
    previousSnapshotSequence,
    worldHash: projection.basis.worldHash,
    readModelHash: projection.basis.readModelHash,
    mapVersion: projection.basis.mapVersion,
    reservationVersion: projection.basis.reservationVersion,
    jobVersion: projection.basis.jobVersion,
    derivedIndexVersion: projection.basis.derivedIndexVersion,
  };
}

function mapRenderEntities(
  projection: GameSessionRenderProjection,
  residents: readonly GameSessionUiResidentV1[],
): readonly GameSessionRenderEntityV1[] {
  const output: GameSessionRenderEntityV1[] = [];
  for (const entity of projection.entities) {
    output.push({
      entity: entity.entity,
      kind: entity.kind === "bed" ? "structure" : entity.kind,
      renderDefId: entity.defId,
      xQ16: entity.xQ16,
      yQ16: entity.yQ16,
      facing: 0,
      animationState: readAnimationState(entity, residents),
      flags: entity.flags,
    });
  }
  return output;
}

function readAnimationState(
  entity: GameSessionRenderEntity,
  residents: readonly GameSessionUiResidentV1[],
): GameSessionAnimationStateV1 {
  if (entity.kind !== "resident") return "idle";
  for (const resident of residents) {
    if (sameEntity(resident.entity, entity.entity)) {
      if (resident.jobState === "blocked" || resident.jobState === "failed") return "blocked";
      if (resident.jobState === "completed") return "completed";
      return resident.activity;
    }
  }
  return "idle";
}

function mapResidents(
  runtime: GameSessionRuntime,
  projection: GameSessionUiProjection,
): readonly GameSessionUiResidentV1[] {
  const output: GameSessionUiResidentV1[] = [];
  for (const resident of projection.residents) {
    const owner = runtime.owners.residents.read(resident.residentId);
    const jobId = resident.currentJobId === GAME_SESSION_NO_JOB ? null : resident.currentJobId;
    const job = jobId === null ? undefined : runtime.owners.jobs.readJob(jobId);
    output.push({
      entity: resident.entity,
      residentId: resident.residentId,
      residentDefId: resident.defId,
      cellIndex: resident.cellIndex,
      activity: resident.activity,
      jobState: readJobState(resident),
      currentJobId: jobId,
      progressQ16: readJobProgressQ16(resident, job?.progressQ16, job?.requiredWorkQ16),
      hunger: resident.hunger,
      rest: resident.rest,
      comfort: resident.comfort,
      social: resident.social,
      safety: resident.safety,
      ownerVersion: owner?.ownerVersion ?? 0,
      reason: mapReason(resident.reason, "resident", resident.residentId),
    });
  }
  return output;
}

function mapResources(
  runtime: GameSessionRuntime,
  projection: GameSessionUiProjection,
): readonly GameSessionUiResourceV1[] {
  const output: GameSessionUiResourceV1[] = [];
  for (const resource of projection.resources) {
    output.push({
      defId: resource.defId,
      resourceKind: readResourceKind(resource.defId),
      total: resource.total,
      available: resource.available,
      reserved: resource.reserved,
      ownerVersion: runtime.owners.items.version,
    });
  }
  return output;
}

function mapJobs(
  residents: readonly GameSessionUiResidentV1[],
): readonly GameSessionUiJobMarkerV1[] {
  const output: GameSessionUiJobMarkerV1[] = [];
  for (const resident of residents) {
    output.push({
      markerId: `resident:${String(resident.residentId)}`,
      jobId: resident.currentJobId,
      state: resident.jobState,
      owner: resident.entity,
      progressQ16: resident.progressQ16,
      ...(resident.reason === undefined ? {} : { reason: resident.reason }),
    });
  }
  return output;
}

function mapAlerts(
  residents: readonly GameSessionUiResidentV1[],
  ownerAlerts: readonly GameSessionStructuredReason[],
): readonly GameSessionAlertV1[] {
  const output: GameSessionAlertV1[] = [];
  for (const resident of residents) {
    if (resident.reason === undefined) continue;
    output.push({
      alertId: `resident:${String(resident.residentId)}:${resident.reason.code}`,
      severity:
        resident.jobState === "blocked" || resident.jobState === "failed" ? "warning" : "info",
      reason: resident.reason,
      subject: resident.entity,
    });
  }
  for (let index = 0; index < ownerAlerts.length; index += 1) {
    const reason = ownerAlerts[index];
    if (reason === undefined) continue;
    output.push({
      alertId: `session:${String(index)}:${reason}`,
      severity: "info",
      reason: mapReason(reason, "session", index),
    });
  }
  return output;
}

function createSelectionDetail(
  runtime: GameSessionRuntime,
  selection: UiDetailSubject | null,
  projectionBasis: GameSessionProjectionBasisV1,
  projection: GameSessionUiProjection,
  residents: readonly GameSessionUiResidentV1[],
  resources: readonly GameSessionUiResourceV1[],
  renderEntities: readonly GameSessionRenderEntity[],
): GameSessionSelectionDetailV1 | null {
  if (selection === null || selection.kind === "session") return null;
  const selected = parseEntityId(selection.entityId);
  if (selected === undefined) return null;
  for (const resident of residents) {
    if (sameEntity(resident.entity, selected)) {
      return {
        kind: "resident",
        basis: { ...projectionBasis, version: 1, ownerVersion: resident.ownerVersion },
        resident,
      };
    }
  }
  for (const render of renderEntities) {
    if (!sameEntity(render.entity, selected)) continue;
    if (render.kind === "resource") {
      const resource = readResourceByDefId(resources, render.defId);
      if (resource === undefined) return null;
      return {
        kind: "resource",
        basis: { ...projectionBasis, version: 1, ownerVersion: resource.ownerVersion },
        resource,
      };
    }
    if (render.kind === "resident") return null;
    return {
      kind: "structure",
      basis: {
        ...projectionBasis,
        version: 1,
        ownerVersion: readStructureOwnerVersion(runtime, render.kind),
      },
      entity: render.entity,
      structureKind: render.kind === "bed" ? "bed" : render.kind,
      structureDefId: render.defId,
      cellIndex: readCellIndex(render.xQ16, render.yQ16, runtime.owners.map.width),
      stateCode: render.flags,
      progressQ16:
        render.kind === "build_site" && runtime.definition.buildSite.buildRequiredTicks > 0
          ? Math.floor(
              (projection.buildProgressTicks * 65_536) /
                runtime.definition.buildSite.buildRequiredTicks,
            )
          : 0,
    };
  }
  return null;
}

function readJobState(resident: GameSessionUiResident): GameSessionJobMarkerStateV1 {
  if (resident.reason === "game_session.job_failed") return "failed";
  if (resident.reason === "game_session.job_completed") return "completed";
  if (resident.reason === "game_session.job_reserved") return "claiming";
  if (resident.activity === "moving") return "moving";
  if (resident.activity === "working") return "working";
  return "idle";
}

function readJobProgressQ16(
  resident: GameSessionUiResident,
  progress: number | undefined,
  required: number | undefined,
): number {
  if (resident.reason === "game_session.job_completed") return 65_536;
  if (progress === undefined || required === undefined || required === 0) return 0;
  return Math.min(65_536, Math.floor((progress * 65_536) / required));
}

function mapReason(
  reason: GameSessionStructuredReason,
  source: GameSessionStructuredReasonV1["source"],
  subjectId: number,
): GameSessionStructuredReasonV1 {
  return { code: reason, source, parameters: [subjectId] };
}

function readResourceKind(defId: number): GameSessionResourceKindV1 {
  if (defId === PR1_RESOURCE_FOOD) return "food";
  if (defId === PR1_RESOURCE_WOOD) return "wood";
  if (defId === PR1_RESOURCE_STONE) return "stone";
  if (defId === PR1_RESOURCE_LAMP_OIL) return "lamp_oil";
  return "other";
}

function readDayPhase(tickOfDay: number): GameSessionDayPhaseV1 {
  if (tickOfDay < TICKS_PER_DAY / 8) return "dawn";
  if (tickOfDay < (TICKS_PER_DAY * 5) / 8) return "day";
  if (tickOfDay < (TICKS_PER_DAY * 3) / 4) return "dusk";
  return "night";
}

function readDaylightQ16(tickOfDay: number): number {
  const phase = readDayPhase(tickOfDay);
  if (phase === "day") return 65_536;
  if (phase === "dawn" || phase === "dusk") return 32_768;
  return 0;
}

function parseEntityId(value: string): GameSessionEntityRefV1 | undefined {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator >= value.length - 1) return undefined;
  const index = Number(value.slice(0, separator));
  const generation = Number(value.slice(separator + 1));
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    !Number.isSafeInteger(generation) ||
    generation < 0
  ) {
    return undefined;
  }
  return { index, generation };
}

function readResourceByDefId(
  resources: readonly GameSessionUiResourceV1[],
  defId: number,
): GameSessionUiResourceV1 | undefined {
  for (const resource of resources) if (resource.defId === defId) return resource;
  return undefined;
}

function readStructureOwnerVersion(
  runtime: GameSessionRuntime,
  kind: GameSessionRenderEntity["kind"],
): number {
  if (kind === "lamp") return runtime.owners.lamps.ownerVersion;
  if (kind === "build_site") return runtime.owners.buildSites.version;
  return runtime.owners.restFixtures.version;
}

function readCellIndex(xQ16: number, yQ16: number, width: number): number {
  return Math.floor(yQ16 / 65_536) * width + Math.floor(xQ16 / 65_536);
}

function sameEntity(left: GameSessionEntityRefV1, right: GameSessionEntityRefV1): boolean {
  return left.index === right.index && left.generation === right.generation;
}
