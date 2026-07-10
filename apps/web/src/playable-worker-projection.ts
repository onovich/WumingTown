import {
  validateCoherentGameSessionProjectionPair,
  type GameSessionEntityRefV1,
  type GameSessionProjectionBasisV1,
  type GameSessionRenderEntityV1,
  type GameSessionRenderProjectionV1,
  type GameSessionSelectionDetailV1,
  type GameSessionStructuredReasonV1,
  type GameSessionUiJobMarkerV1,
  type GameSessionUiProjectionV1,
  type GameSessionUiResidentV1,
  type GameSessionUiResourceV1,
  type StructuredReasonReadModel,
  type TileCoordinate,
  type TownAlertReadModel,
  type WorldEntityActivityReadModel,
  type WorldEntityKind,
  type WorldEntityReadModel,
  type WorldFocusMarkerReadModel,
  type WorldReadModel,
} from "@wuming-town/sim-protocol";

export interface WebGameSessionProjectionFrame {
  readonly basis: GameSessionProjectionBasisV1;
  readonly render: GameSessionRenderProjectionV1;
  readonly ui: GameSessionUiProjectionV1;
}

export type WebGameSessionFrameUpdate =
  | { readonly status: "pending" }
  | { readonly status: "ready"; readonly frame: WebGameSessionProjectionFrame }
  | { readonly status: "invalid"; readonly detail: string };

export interface WebGameSessionProjectionAssembler {
  pushRender(projection: GameSessionRenderProjectionV1): WebGameSessionFrameUpdate;
  pushUi(projection: GameSessionUiProjectionV1): WebGameSessionFrameUpdate;
  reset(): void;
}

export function createWebGameSessionProjectionAssembler(): WebGameSessionProjectionAssembler {
  let pendingRender: GameSessionRenderProjectionV1 | undefined;
  let pendingUi: GameSessionUiProjectionV1 | undefined;

  function tryPair(): WebGameSessionFrameUpdate {
    if (pendingRender === undefined || pendingUi === undefined) {
      return { status: "pending" };
    }
    if (pendingRender.basis.snapshotSequence !== pendingUi.basis.snapshotSequence) {
      if (pendingRender.basis.snapshotSequence > pendingUi.basis.snapshotSequence) {
        pendingUi = undefined;
      } else {
        pendingRender = undefined;
      }
      return { status: "pending" };
    }
    const validation = validateCoherentGameSessionProjectionPair(pendingRender, pendingUi);
    if (!validation.ok) {
      return { status: "invalid", detail: validation.reason.detail };
    }
    const frame = {
      basis: pendingRender.basis,
      render: pendingRender,
      ui: pendingUi,
    } satisfies WebGameSessionProjectionFrame;
    pendingRender = undefined;
    pendingUi = undefined;
    return { status: "ready", frame };
  }

  return {
    pushRender(projection): WebGameSessionFrameUpdate {
      pendingRender = projection;
      return tryPair();
    },
    pushUi(projection): WebGameSessionFrameUpdate {
      pendingUi = projection;
      return tryPair();
    },
    reset(): void {
      pendingRender = undefined;
      pendingUi = undefined;
    },
  };
}

export function createGameSessionLifecycleReadModel(
  sessionId: string,
  state: "connecting" | "fatal",
  detail?: string,
): WorldReadModel {
  return {
    sessionId,
    mapName: "GameSession",
    tileSize: 16,
    chunkSize: 1,
    mapWidth: 1,
    mapHeight: 1,
    town: {
      settlementName: "Wuming Town / 无明镇",
      phaseLabel: state === "connecting" ? "Connecting" : "Unavailable",
      cycleLabel:
        detail ??
        (state === "connecting"
          ? "Waiting for validated GameSession projection"
          : "Authoritative GameSession closed"),
      speedLabel: state === "connecting" ? "Initializing" : "Fatal",
      alerts: [],
      resources: [],
    },
    chunks: [],
    entities: [],
    focusMarkers: [],
    selectedEntityId: "",
  };
}

export function createGameSessionWorldReadModel(input: {
  readonly frame: WebGameSessionProjectionFrame;
  readonly selectedEntityId: string | null | undefined;
}): WorldReadModel {
  const residents = indexResidents(input.frame.ui.residents);
  const resources = indexResources(input.frame.ui.resources);
  const entities: WorldEntityReadModel[] = [];
  const tiles = new Map<string, TileCoordinate>();
  for (const renderEntity of input.frame.render.entities) {
    const tile = readRenderTile(renderEntity, input.frame.render.tileSizeQ16);
    tiles.set(entityKey(renderEntity.entity), tile);
    entities.push(
      createWorldEntity(
        renderEntity,
        tile,
        residents.get(entityKey(renderEntity.entity)),
        resources.get(renderEntity.renderDefId),
        input.frame.ui.selectionDetail,
        input.selectedEntityId,
      ),
    );
  }
  const selectedEntityId = readSelectedEntityId(entities, input.selectedEntityId);
  return {
    sessionId: input.frame.basis.scenarioId,
    mapName: input.frame.basis.scenarioId,
    tileSize: readPresentationTileSize(input.frame.render.tileSizeQ16),
    chunkSize: 16,
    mapWidth: input.frame.render.mapWidth,
    mapHeight: input.frame.render.mapHeight,
    town: {
      settlementName: "Wuming Town / 无明镇",
      phaseLabel: input.frame.ui.dayPhase,
      cycleLabel: `Day ${String(input.frame.ui.dayIndex + 1)} · ${String(input.frame.ui.tickOfDay)}/${String(input.frame.ui.ticksPerDay)}`,
      speedLabel: input.frame.ui.paused
        ? "Paused"
        : `${String(input.frame.ui.requestedSpeed)}x · ${String(input.frame.ui.effectiveTicksPerSecond)} TPS`,
      alerts: input.frame.ui.alerts.map(mapAlert),
      resources: [],
    },
    chunks: [],
    entities,
    focusMarkers: createJobFocusMarkers(input.frame.ui.jobs, tiles),
    selectedEntityId,
  };
}

function createWorldEntity(
  render: GameSessionRenderEntityV1,
  tile: TileCoordinate,
  resident: GameSessionUiResidentV1 | undefined,
  resource: GameSessionUiResourceV1 | undefined,
  selection: GameSessionSelectionDetailV1 | null,
  selectedEntityId: string | null | undefined,
): WorldEntityReadModel {
  const id = entityKey(render.entity);
  const selectedDetail =
    id === selectedEntityId && selectionMatchesRender(selection, render) ? selection : null;
  if (resident !== undefined) {
    const reason = resident.reason === undefined ? undefined : mapReason(resident.reason);
    const progressPercent = toPercent(resident.progressQ16);
    const activity = createResidentActivity(resident, reason, progressPercent);
    return {
      entityId: id,
      displayName: `Resident ${String(resident.residentId + 1)}`,
      kind: "resident",
      tile,
      colorHex: colorFor(render),
      summary: reason?.detail ?? formatJobState(resident.jobState),
      inspector: {
        roleLabel: `Resident def ${String(resident.residentDefId)}`,
        currentJob:
          resident.currentJobId === null ? "No active job" : `Job ${String(resident.currentJobId)}`,
        currentStep: formatJobState(resident.jobState),
        moodLabel: "—",
        healthLabel: "—",
        lastDecision:
          selectedDetail?.kind === "resident"
            ? formatJobState(selectedDetail.resident.jobState)
            : "—",
        explainers: [],
        thoughts: [],
        needs: [],
      },
      activity,
    };
  }
  const detail = readStructureDetail(selectedDetail, render);
  return {
    entityId: id,
    displayName:
      render.kind === "resource"
        ? formatResourceKind(resource)
        : `${formatEntityKind(render.kind)} ${String(render.renderDefId)}`,
    kind: mapEntityKind(render.kind),
    tile,
    colorHex: colorFor(render),
    summary:
      resource === undefined
        ? detail
        : `${String(resource.available)} available, ${String(resource.reserved)} reserved, ${String(resource.total)} total`,
    inspector: {
      roleLabel: `${formatEntityKind(render.kind)} def ${String(render.renderDefId)}`,
      currentJob: "—",
      currentStep: detail,
      moodLabel: "—",
      healthLabel: "—",
      lastDecision: detail,
      explainers: [],
      thoughts: [],
      needs: [],
    },
    activity: {
      state: render.animationState,
      label: render.animationState,
      detail,
    },
  };
}

function createResidentActivity(
  resident: GameSessionUiResidentV1,
  reason: StructuredReasonReadModel | undefined,
  progressPercent: number,
): WorldEntityActivityReadModel {
  const state =
    resident.jobState === "blocked" || resident.jobState === "failed"
      ? "blocked"
      : resident.jobState === "completed"
        ? "completed"
        : resident.activity;
  return {
    state,
    label: formatJobState(resident.jobState),
    detail: reason?.detail ?? formatJobState(resident.jobState),
    progressPercent,
  };
}

function createJobFocusMarkers(
  jobs: readonly GameSessionUiJobMarkerV1[],
  tiles: ReadonlyMap<string, TileCoordinate>,
): readonly WorldFocusMarkerReadModel[] {
  const markers: WorldFocusMarkerReadModel[] = [];
  for (const job of jobs) {
    const subject = job.target ?? job.owner;
    const tile = subject === undefined ? undefined : tiles.get(entityKey(subject));
    if (tile === undefined) continue;
    markers.push({
      markerId: job.markerId,
      kind:
        job.state === "blocked" || job.state === "failed"
          ? "blocked"
          : job.state === "completed"
            ? "completed"
            : "selectable",
      label: `${job.markerId}: ${formatJobState(job.state)} ${String(toPercent(job.progressQ16))}%`,
      tile,
      ...(subject === undefined ? {} : { entityId: entityKey(subject) }),
    });
  }
  return markers;
}

function indexResidents(
  residents: readonly GameSessionUiResidentV1[],
): ReadonlyMap<string, GameSessionUiResidentV1> {
  const output = new Map<string, GameSessionUiResidentV1>();
  for (const resident of residents) output.set(entityKey(resident.entity), resident);
  return output;
}

function indexResources(
  resources: readonly GameSessionUiResourceV1[],
): ReadonlyMap<number, GameSessionUiResourceV1> {
  const output = new Map<number, GameSessionUiResourceV1>();
  for (const resource of resources) output.set(resource.defId, resource);
  return output;
}

function mapAlert(alert: GameSessionUiProjectionV1["alerts"][number]): TownAlertReadModel {
  return {
    severity:
      alert.severity === "critical"
        ? "danger"
        : alert.severity === "warning"
          ? "warning"
          : "stable",
    label: `${alert.reason.code} · ${alert.alertId}`,
    detail: formatReason(alert.reason),
  };
}

function mapReason(reason: GameSessionStructuredReasonV1): StructuredReasonReadModel {
  return { code: reason.code, source: reason.source, detail: formatReason(reason) };
}

function formatReason(reason: GameSessionStructuredReasonV1): string {
  const parameters = reason.parameters.map(String).join(", ");
  return parameters.length === 0
    ? `${reason.code} (${reason.source})`
    : `${reason.code} (${reason.source}: ${parameters})`;
}

function readStructureDetail(
  detail: GameSessionSelectionDetailV1 | null,
  render: GameSessionRenderEntityV1,
): string {
  if (detail?.kind !== "structure" || !sameEntity(detail.entity, render.entity)) {
    return "—";
  }
  const reason = detail.reason === undefined ? "" : ` · ${formatReason(detail.reason)}`;
  return `${detail.structureKind} state ${String(detail.stateCode)} · ${String(toPercent(detail.progressQ16))}%${reason}`;
}

function selectionMatchesRender(
  detail: GameSessionSelectionDetailV1 | null,
  render: GameSessionRenderEntityV1,
): boolean {
  if (detail === null) return false;
  if (detail.kind === "resident") return sameEntity(detail.resident.entity, render.entity);
  if (detail.kind === "structure") return sameEntity(detail.entity, render.entity);
  return render.kind === "resource" && detail.resource.defId === render.renderDefId;
}

function readSelectedEntityId(
  entities: readonly WorldEntityReadModel[],
  selectedEntityId: string | null | undefined,
): string {
  if (selectedEntityId === null) return "";
  if (selectedEntityId !== undefined) {
    return entities.some((entity) => entity.entityId === selectedEntityId) ? selectedEntityId : "";
  }
  return (
    entities.find((entity) => entity.kind === "resident")?.entityId ?? entities[0]?.entityId ?? ""
  );
}

function readRenderTile(entity: GameSessionRenderEntityV1, tileSizeQ16: number): TileCoordinate {
  return { x: entity.xQ16 / tileSizeQ16, y: entity.yQ16 / tileSizeQ16 };
}

function readPresentationTileSize(tileSizeQ16: number): number {
  return Math.max(8, Math.min(32, Math.round(tileSizeQ16 / 4_096)));
}

function mapEntityKind(kind: GameSessionRenderEntityV1["kind"]): WorldEntityKind {
  if (kind === "resident" || kind === "resource") return kind;
  return "structure";
}

function formatEntityKind(kind: GameSessionRenderEntityV1["kind"]): string {
  return kind.replace("_", " ");
}

function formatResourceKind(resource: GameSessionUiResourceV1 | undefined): string {
  if (resource === undefined) return "Resource";
  if (resource.resourceKind === "lamp_oil") return "Lamp oil";
  return resource.resourceKind.charAt(0).toUpperCase() + resource.resourceKind.slice(1);
}

function formatJobState(state: GameSessionUiJobMarkerV1["state"]): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function colorFor(entity: GameSessionRenderEntityV1): number {
  if (entity.kind === "resident") return 0x84dcc6;
  if (entity.kind === "resource") return 0x90be6d;
  if (entity.kind === "lamp") return 0xf4d35e;
  if (entity.kind === "build_site") return 0xf8961e;
  return 0xa58b68;
}

function toPercent(valueQ16: number): number {
  return Math.max(0, Math.min(100, Math.round((valueQ16 * 100) / 65_536)));
}

function entityKey(entity: GameSessionEntityRefV1): string {
  return `${String(entity.index)}:${String(entity.generation)}`;
}

function sameEntity(left: GameSessionEntityRefV1, right: GameSessionEntityRefV1): boolean {
  return left.index === right.index && left.generation === right.generation;
}
