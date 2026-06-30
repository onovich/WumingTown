import type {
  CellRef,
  CommandBlockedReason,
  PlayableOrderJobProjectionV1,
  PlayablePawnProjectionV1,
  PlayablePlacementProjectionV1,
  PlayableProjectionV1,
  PlayableResourceCountProjectionV1,
  PlayableTargetActionProjectionV1,
  ProtocolEntityRef,
  StructuredReasonReadModel,
  TileCoordinate,
  TownAlertReadModel,
  WorldEntityActivityReadModel,
  WorldEntityReadModel,
  WorldFocusMarkerReadModel,
  WorldJobMarkerReadModel,
  WorldReadModel,
  WorldSemanticAreaReadModel,
} from "@wuming-town/sim-protocol";
import type {
  ShellBuildModeState,
  ShellPlayableActionState,
  ShellPlayableCommandSurfaceState,
  ShellPlayableCommandTemplateState,
  ShellPlayablePlacementPreviewState,
} from "@wuming-town/ui-react";

export interface ProjectedPlayableDebugState {
  readonly build?: {
    readonly active: boolean;
    readonly completed: boolean;
    readonly progressPercent?: number;
  };
  readonly currentTick: number;
  readonly lamps: readonly {
    readonly progressPercent?: number;
    readonly state: PlayableProjectionV1["lamps"][number]["state"];
  }[];
  readonly latestCommand?: {
    readonly actionId: ShellPlayableActionState["actionId"];
    readonly commandId: string;
    readonly markerState?: WorldJobMarkerReadModel["state"];
    readonly progressPercent?: number;
    readonly reasonCode?: string;
    readonly status: ShellPlayableActionState["status"];
  };
  readonly jobMarkers: readonly {
    readonly commandId: string;
    readonly markerId: string;
    readonly ownerEntityId?: string;
    readonly progressPercent?: number;
    readonly state: WorldJobMarkerReadModel["state"];
  }[];
  readonly pawns: readonly {
    readonly entityId: string;
    readonly progressPercent?: number;
    readonly state: NonNullable<WorldEntityReadModel["activity"]>["state"];
    readonly tile: TileCoordinate;
  }[];
}

const PLAYABLE_AUTHORITY = "simulation-worker-projection";
const STRUCTURE_ENTITY_ID = "east-market-lantern-post";
const STRUCTURE_DISPLAY_NAME = "East Market Lantern Post";
const ACTOR_TO_ENTITY_ID = new Map<string, string>([
  [entityRefKey({ index: 0, generation: 1 }), "lantern-keeper-shen"],
  [entityRefKey({ index: 1, generation: 1 }), "lamp-aide-15"],
]);
const SITE_TO_ENTITY_ID = new Map<string, string>([
  [entityRefKey({ index: 4, generation: 1 }), STRUCTURE_ENTITY_ID],
]);

export function createProjectedPlayableDebugState(
  projection: PlayableProjectionV1 | undefined,
  action: ShellPlayableActionState | undefined,
  readModel: WorldReadModel,
): ProjectedPlayableDebugState | undefined {
  if (projection === undefined) {
    return undefined;
  }

  return {
    ...(projection.build === undefined
      ? {}
      : {
          build: {
            active: projection.build.active,
            completed: projection.build.completed,
            ...(projection.build.buildRequiredTicks <= 0
              ? {}
              : {
                  progressPercent: Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        (projection.build.buildProgressTicks /
                          projection.build.buildRequiredTicks) *
                          100,
                      ),
                    ),
                  ),
                }),
          },
        }),
    currentTick: projection.basis.tick,
    lamps: projection.lamps.map((lamp) => {
      const progressPercent = toProgressPercent(lamp.progressQ16, lamp.requiredWork);
      return {
        ...(progressPercent === undefined ? {} : { progressPercent }),
        state: lamp.state,
      };
    }),
    ...(action === undefined
      ? {}
      : {
          latestCommand: {
            actionId: action.actionId,
            commandId: action.commandId,
            ...(action.markerState === undefined ? {} : { markerState: action.markerState }),
            ...(action.progressPercent === undefined
              ? {}
              : { progressPercent: action.progressPercent }),
            ...(action.reasonCode === undefined ? {} : { reasonCode: action.reasonCode }),
            status: action.status,
          },
        }),
    jobMarkers: (readModel.jobMarkers ?? []).map((marker) => ({
      commandId: marker.commandId,
      markerId: marker.markerId,
      ...(marker.ownerEntityId === undefined ? {} : { ownerEntityId: marker.ownerEntityId }),
      ...(marker.progressPercent === undefined ? {} : { progressPercent: marker.progressPercent }),
      state: marker.state,
    })),
    pawns: readModel.entities
      .filter(
        (entity) => entity.entityId === "lantern-keeper-shen" || entity.entityId === "lamp-aide-15",
      )
      .map((entity) => ({
        entityId: entity.entityId,
        ...(entity.activity?.progressPercent === undefined
          ? {}
          : { progressPercent: entity.activity.progressPercent }),
        state: entity.activity?.state ?? "idle",
        tile: entity.tile,
      })),
  };
}

export function createPlayableCommandSurface(
  projection: PlayableProjectionV1,
): ShellPlayableCommandSurfaceState {
  return {
    currentTick: projection.basis.tick,
    lampCommands: projection.targets
      .filter((target) => target.target.kind === "lamp" || target.target.kind === "lamp_gap")
      .flatMap((target) => mapLampCommands(target)),
    buildPlacements: projection.placements.map((placement) => mapPlacement(placement)),
  };
}

export function createPlayableWorldReadModel(input: {
  readonly baseReadModel: WorldReadModel;
  readonly projection: PlayableProjectionV1;
  readonly buildMode: ShellBuildModeState;
  readonly hoverTile: TileCoordinate | undefined;
  readonly selectedEntityId: string | undefined;
}): WorldReadModel {
  const actors = new Map<string, PlayablePawnProjectionV1>();
  for (const pawn of input.projection.pawns) {
    const entityId = ACTOR_TO_ENTITY_ID.get(entityRefKey(pawn.actor));
    if (entityId !== undefined) {
      actors.set(entityId, pawn);
    }
  }

  const ordersByEntity = new Map<string, PlayableOrderJobProjectionV1>();
  for (const order of input.projection.orders) {
    if (order.owner === undefined) {
      continue;
    }
    const entityId = ACTOR_TO_ENTITY_ID.get(entityRefKey(order.owner));
    if (entityId !== undefined) {
      ordersByEntity.set(entityId, order);
    }
  }

  const entities: WorldEntityReadModel[] = [];
  let hasStructure = false;
  for (const entity of input.baseReadModel.entities) {
    if (entity.entityId === STRUCTURE_ENTITY_ID) {
      hasStructure = true;
    }

    const pawn = actors.get(entity.entityId);
    if (pawn !== undefined) {
      entities.push(mapPawnEntity(entity, pawn, ordersByEntity.get(entity.entityId)));
      continue;
    }

    entities.push(entity);
  }

  if (!hasStructure) {
    entities.push(createStructureEntity(input.projection));
  }

  const build = input.projection.build;
  const hoveredPlacement = readHoveredPlacement(input.projection.placements, input.hoverTile);
  const semanticAreas = [
    ...(input.baseReadModel.semanticAreas ?? []),
    ...(build === undefined
      ? []
      : [
          createBuildSemanticArea(build.completed ? "structure" : "blocked-area", build.anchorCell),
        ]),
    ...(input.buildMode === "place-simple-lamp-post" && hoveredPlacement !== undefined
      ? [createPlacementSemanticArea(hoveredPlacement)]
      : []),
  ];
  const focusMarkers = [
    ...(input.baseReadModel.focusMarkers ?? []).filter(
      (marker) => marker.entityId !== "lamp-aide-15",
    ),
    createStructureFocusMarker(build),
    ...(input.buildMode === "place-simple-lamp-post" && input.hoverTile !== undefined
      ? [createHoverFocusMarker(hoveredPlacement, input.hoverTile)]
      : []),
  ];

  return {
    ...input.baseReadModel,
    town: {
      ...input.baseReadModel.town,
      alerts: createTownAlerts(input.baseReadModel.town.alerts, input.projection),
      resources: input.projection.resources.materials.map(mapResourceSummary),
    },
    entities,
    focusMarkers,
    jobMarkers: input.projection.orders.map(mapJobMarker),
    semanticAreas,
    selectedEntityId: input.selectedEntityId ?? input.baseReadModel.selectedEntityId,
  };
}

export function patchPlayableActionFromProjection(
  action: ShellPlayableActionState | undefined,
  projection: PlayableProjectionV1 | undefined,
): ShellPlayableActionState | undefined {
  if (action === undefined || projection === undefined || action.status === "rejected") {
    return action;
  }

  const order = projection.orders.find((candidate) => candidate.commandId === action.commandId);
  if (order === undefined) {
    return action;
  }

  const progressPercent = toProgressPercent(order.progressQ16, order.requiredWork);
  return {
    ...action,
    markerState: order.markerState,
    orderId: order.orderId,
    ...(progressPercent === undefined ? {} : { progressPercent }),
    ...(order.blockedReason === undefined ? {} : mapReasonFields(order.blockedReason)),
  };
}

function mapLampCommands(
  target: PlayableTargetActionProjectionV1,
): readonly ShellPlayableCommandTemplateState[] {
  const output: ShellPlayableCommandTemplateState[] = [];
  for (const action of target.actions) {
    if (action.commandKind !== "PrioritizeLampWork") {
      continue;
    }
    output.push({
      actionId: "prioritize-lamp-work",
      commandKind: action.commandKind,
      commandBasis: action.commandBasis,
      payload: action.payload,
      available: action.available,
      ...(action.disabledReason === undefined ? {} : mapReasonFields(action.disabledReason)),
      targetEntityId: STRUCTURE_ENTITY_ID,
      targetLabel: STRUCTURE_DISPLAY_NAME,
      targetTile: mapPlayableTile(readTargetCell(target)),
    });
  }
  return output;
}

function mapPlacement(
  placement: PlayablePlacementProjectionV1,
): ShellPlayablePlacementPreviewState {
  return {
    anchorTile: mapPlayableTile(placement.anchorCell),
    footprintTiles: placement.footprint.map(mapPlayableTile),
    interactionTiles: placement.interactionCells.map(mapPlayableTile),
    valid: placement.valid,
    ...(readPlacementReason(placement) === undefined
      ? {}
      : mapReasonFields(readPlacementReason(placement) ?? failMissingReason())),
    command: {
      actionId: "queue-simple-build",
      commandKind: placement.command.commandKind,
      commandBasis: placement.command.commandBasis,
      payload: placement.command.payload,
      available: placement.command.available,
      ...(placement.command.disabledReason === undefined
        ? {}
        : mapReasonFields(placement.command.disabledReason)),
      targetEntityId: STRUCTURE_ENTITY_ID,
      targetLabel: STRUCTURE_DISPLAY_NAME,
      targetTile: mapPlayableTile(placement.anchorCell),
    },
  };
}

function mapPawnEntity(
  baseEntity: WorldEntityReadModel,
  pawn: PlayablePawnProjectionV1,
  order: PlayableOrderJobProjectionV1 | undefined,
): WorldEntityReadModel {
  const tile = mapPlayableTile(cellFromIndex(pawn.cellIndex));
  const targetTile = mapPlayableTile(cellFromIndex(pawn.pathTargetCell));
  const progressPercent =
    order === undefined ? undefined : toProgressPercent(order.progressQ16, order.requiredWork);
  const task =
    order === undefined
      ? undefined
      : {
          commandId: order.commandId,
          jobKind: normalizeStructuredJobKind(order.jobKind),
          orderId: order.orderId,
          ...(progressPercent === undefined ? {} : { progressPercent }),
          ...(order.blockedReason === undefined
            ? {}
            : { reason: mapStructuredReason(order.blockedReason) }),
          state: order.markerState,
          stepLabel: describeMarkerState(order.markerState),
          targetLabel: STRUCTURE_DISPLAY_NAME,
          targetTile,
        };
  const activity: WorldEntityActivityReadModel = {
    detail:
      order?.blockedReason?.code === undefined
        ? describePawnState(pawn.state)
        : describeCommandBlockedReason(order.blockedReason),
    intentLabel: STRUCTURE_DISPLAY_NAME,
    label: describePawnState(pawn.state),
    ...(progressPercent === undefined ? {} : { progressPercent }),
    state: mapPawnState(pawn.state),
    targetEntityId: STRUCTURE_ENTITY_ID,
    targetTile,
  };

  return {
    ...baseEntity,
    tile,
    summary: describePawnState(pawn.state),
    inspector: {
      ...baseEntity.inspector,
      currentJob:
        order === undefined
          ? baseEntity.inspector.currentJob
          : formatJobKind(normalizeStructuredJobKind(order.jobKind)),
      currentStep: task?.stepLabel ?? baseEntity.inspector.currentStep,
      lastDecision: activity.detail,
      ...(task === undefined ? {} : { task }),
    },
    activity,
  };
}

function createStructureEntity(projection: PlayableProjectionV1): WorldEntityReadModel {
  const build = projection.build;
  const tile = mapPlayableTile(build?.anchorCell ?? readTargetCell(projection.targets[0]));
  const summary =
    build?.completed === true
      ? "Authoritative structure completed."
      : build?.active === true
        ? "Authoritative structure is under construction."
        : "Authoritative lamp gap is awaiting player action.";
  return {
    entityId: STRUCTURE_ENTITY_ID,
    displayName: STRUCTURE_DISPLAY_NAME,
    kind: "structure",
    tile,
    colorHex: 0xf6bd60,
    summary,
    inspector: {
      roleLabel: "Lamp structure",
      currentJob: build?.completed === true ? "Lamp post completed" : "Build placement",
      currentStep:
        build?.completed === true
          ? "Authoritative structure is stable"
          : build?.active === true
            ? "Authoritative build is in progress"
            : "Select this structure or enter build mode",
      moodLabel: "Stable",
      healthLabel: "Structural",
      lastDecision: summary,
      explainers: ["This structure is rendered from the authoritative Worker projection."],
      thoughts: ["UI reads projection state only and does not own structure mutation."],
      needs: [],
    },
  };
}

function createStructureFocusMarker(
  build: PlayableProjectionV1["build"],
): WorldFocusMarkerReadModel {
  const tile = mapPlayableTile(build?.anchorCell ?? { x: 12, y: 7, cellIndex: 124 });
  return {
    markerId: "wm0152-structure-select",
    kind: build?.completed === true ? "completed" : "selectable",
    label: build?.completed === true ? "Completed lamp post" : "Lamp build target",
    tile,
    entityId: STRUCTURE_ENTITY_ID,
  };
}

function createHoverFocusMarker(
  placement: PlayablePlacementProjectionV1 | undefined,
  hoverTile: TileCoordinate,
): WorldFocusMarkerReadModel {
  return {
    markerId: "wm0152-build-hover",
    kind: placement?.valid === true ? "selectable" : "blocked",
    label:
      placement?.valid === true ? "Valid blueprint placement" : "No authoritative placement here",
    tile: hoverTile,
  };
}

function createPlacementSemanticArea(
  placement: PlayablePlacementProjectionV1,
): WorldSemanticAreaReadModel {
  return createBuildSemanticArea(
    placement.valid ? "structure" : "blocked-area",
    placement.anchorCell,
  );
}

function createBuildSemanticArea(
  kind: WorldSemanticAreaReadModel["kind"],
  anchorCell: CellRef,
): WorldSemanticAreaReadModel {
  const originTile = mapPlayableTile(anchorCell);
  return {
    areaId: "wm0152-build-preview",
    kind,
    label: kind === "blocked-area" ? "Blocked build preview" : "Lamp build footprint",
    originTile,
    width: 8,
    height: 8,
    emphasisTile: originTile,
  };
}

function createTownAlerts(
  baseAlerts: readonly TownAlertReadModel[],
  projection: PlayableProjectionV1,
): readonly TownAlertReadModel[] {
  const alerts: TownAlertReadModel[] = [...baseAlerts];
  const lamp = projection.lamps[0];
  if (lamp?.state === "completed") {
    alerts.push({
      severity: "stable",
      label: "Lantern corridor stabilized",
      detail: "The authoritative lamp order has completed.",
    });
  } else if (lamp?.blockedReason !== undefined) {
    alerts.push({
      severity: "warning",
      label: "Lamp order blocked",
      detail: describeCommandBlockedReason(lamp.blockedReason),
    });
  }

  if (projection.build?.completed === true) {
    alerts.push({
      severity: "stable",
      label: "Lantern post raised",
      detail: "The authoritative build order completed the structure.",
    });
  }

  for (const alert of projection.alerts) {
    alerts.push({
      severity: "warning",
      label: formatReasonLabel(alert.code),
      detail: describeCommandBlockedReason(alert),
    });
  }

  return alerts.length > 0
    ? alerts
    : [{ severity: "stable", label: "Worker projection active", detail: PLAYABLE_AUTHORITY }];
}

function mapResourceSummary(
  resource: PlayableResourceCountProjectionV1,
): WorldReadModel["town"]["resources"][number] {
  return {
    label: resourceLabel(resource.defId),
    amount: resource.availableAmount,
    unit: "u",
    trend:
      resource.availableAmount === 0
        ? "falling"
        : resource.reservedAmount > 0
          ? "steady"
          : "rising",
  };
}

function mapJobMarker(order: PlayableOrderJobProjectionV1): WorldJobMarkerReadModel {
  const targetTile = mapPlayableTile(readTargetCellFromOrder(order));
  const ownerEntityId =
    order.owner === undefined ? undefined : ACTOR_TO_ENTITY_ID.get(entityRefKey(order.owner));
  const progressPercent = toProgressPercent(order.progressQ16, order.requiredWork);
  return {
    markerId: `${order.orderId}-${String(order.jobId)}`,
    orderId: order.orderId,
    commandId: order.commandId,
    jobKind: normalizeStructuredJobKind(order.jobKind),
    state: order.markerState,
    label: formatJobKind(normalizeStructuredJobKind(order.jobKind)),
    detail: describeMarkerState(order.markerState),
    tile: targetTile,
    ...(progressPercent === undefined ? {} : { progressPercent }),
    ...(ownerEntityId === undefined ? {} : { ownerEntityId }),
    targetEntityId:
      order.target.kind === "build_site"
        ? (SITE_TO_ENTITY_ID.get(entityRefKey(order.target.site)) ?? STRUCTURE_ENTITY_ID)
        : STRUCTURE_ENTITY_ID,
    ...(order.blockedReason === undefined
      ? {}
      : { reason: mapStructuredReason(order.blockedReason) }),
  };
}

function readHoveredPlacement(
  placements: readonly PlayablePlacementProjectionV1[],
  hoverTile: TileCoordinate | undefined,
): PlayablePlacementProjectionV1 | undefined {
  if (hoverTile === undefined) {
    return undefined;
  }

  for (const placement of placements) {
    if (
      matchesTile(mapPlayableTile(placement.anchorCell), hoverTile) ||
      placement.footprint.some((cell) => matchesTile(mapPlayableTile(cell), hoverTile)) ||
      placement.interactionCells.some((cell) => matchesTile(mapPlayableTile(cell), hoverTile))
    ) {
      return placement;
    }
  }

  return undefined;
}

function matchesTile(left: TileCoordinate, right: TileCoordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

function mapPlayableTile(cell: CellRef): TileCoordinate {
  return {
    x: cell.x * 8 + 24,
    y: cell.y * 8 + 36,
  };
}

function cellFromIndex(cellIndex: number): CellRef {
  return {
    x: cellIndex % 16,
    y: Math.floor(cellIndex / 16),
    cellIndex,
  };
}

function readTargetCell(target: PlayableTargetActionProjectionV1 | undefined): CellRef {
  if (target?.target.kind === "lamp_gap") {
    return target.target.anchorCell;
  }
  if (target?.target.kind === "build_cell") {
    return target.target.anchorCell;
  }
  if (target?.target.kind === "build_site") {
    return { x: 12, y: 7, cellIndex: 124 };
  }
  return { x: 12, y: 7, cellIndex: 124 };
}

function readTargetCellFromOrder(order: PlayableOrderJobProjectionV1): CellRef {
  if (order.target.kind === "lamp_gap" || order.target.kind === "build_cell") {
    return order.target.anchorCell;
  }
  if (order.target.kind === "build_site") {
    return { x: 12, y: 7, cellIndex: 124 };
  }
  return { x: 12, y: 7, cellIndex: 124 };
}

function readPlacementReason(
  placement: PlayablePlacementProjectionV1,
): CommandBlockedReason | undefined {
  return placement.blockedReason ?? placement.command.disabledReason;
}

function mapReasonFields(reason: CommandBlockedReason): {
  readonly blockedReasonCode: string;
  readonly blockedReasonDetail: string;
  readonly blockedReasonSource: string;
} {
  return {
    blockedReasonCode: reason.code,
    blockedReasonDetail: describeCommandBlockedReason(reason),
    blockedReasonSource: reason.source,
  };
}

function mapStructuredReason(reason: CommandBlockedReason): StructuredReasonReadModel {
  return {
    code: reason.code,
    detail: describeCommandBlockedReason(reason),
    source: reason.source,
  };
}

function toProgressPercent(progressQ16: number, requiredWork: number): number | undefined {
  if (requiredWork <= 0) {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round((progressQ16 / requiredWork) * 100)));
}

function mapPawnState(
  state: PlayablePawnProjectionV1["state"],
): NonNullable<WorldEntityReadModel["activity"]>["state"] {
  return state === "failed" ? "blocked" : state;
}

function normalizeStructuredJobKind(
  jobKind: PlayableOrderJobProjectionV1["jobKind"],
): WorldJobMarkerReadModel["jobKind"] {
  return jobKind === "lamp_repair" ? "lamp_refill" : jobKind;
}

function formatJobKind(jobKind: WorldJobMarkerReadModel["jobKind"]): string {
  switch (jobKind) {
    case "build_site_construction":
      return "Build construction";
    case "build_site_delivery":
      return "Build delivery";
    default:
      return "Lamp refill";
  }
}

function describeCommandBlockedReason(reason: CommandBlockedReason): string {
  const prefix = formatReasonLabel(reason.code);
  if (reason.requirement !== undefined) {
    return `${prefix}: ${resourceLabel(reason.requirement.defId)} ${String(reason.requirement.availableAmount)}/${String(reason.requirement.requiredAmount)}`;
  }

  if (reason.policy !== undefined) {
    return `${prefix}: ${reason.policy.reasonCode}`;
  }

  if (reason.basis?.observedTick !== undefined && reason.basis.expectedTick !== undefined) {
    return `${prefix}: tick ${String(reason.basis.observedTick)} != ${String(reason.basis.expectedTick)}`;
  }

  return prefix;
}

function describeMarkerState(state: WorldJobMarkerReadModel["state"]): string {
  switch (state) {
    case "claimed":
      return "Claimed by a worker";
    case "moving":
      return "Worker moving";
    case "working":
      return "Work in progress";
    case "blocked":
      return "Blocked with a structured reason";
    case "completed":
      return "Completed";
    default:
      return "Queued for worker pickup";
  }
}

function describePawnState(state: PlayablePawnProjectionV1["state"]): string {
  switch (state) {
    case "moving":
      return "Moving to the order target";
    case "working":
      return "Working on the current order";
    case "blocked":
      return "Blocked on the current order";
    case "completed":
      return "Order completed";
    case "failed":
      return "Order failed";
    default:
      return "Idle";
  }
}

function resourceLabel(defId: number): string {
  if (defId === 1) {
    return "Wood";
  }
  if (defId === 2) {
    return "Stone";
  }
  if (defId === 6) {
    return "Repair frame";
  }
  return `Material ${String(defId)}`;
}

function formatReasonLabel(code: string): string {
  return code
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function entityRefKey(entity: ProtocolEntityRef): string {
  return `${String(entity.index)}:${String(entity.generation)}`;
}

function failMissingReason(): never {
  throw new Error("Expected placement blocked reason.");
}
