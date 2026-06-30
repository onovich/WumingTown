import {
  PLAYABLE_COMMAND_SLICE_LAMP_WORK_TICKS,
  type PlayableReadModel,
} from "@wuming-town/sim-core";
import {
  PLAYER_COMMAND_KIND,
  type CommandBasis,
  type CommandBlockedReason,
  type PlayableBuildProjectionV1,
  type PlayableCommandTemplateV1,
  type PlayableLampProjectionV1,
  type PlayableOrderJobProjectionV1,
  type PlayablePawnProjectionV1,
  type PlayablePlacementProjectionV1,
  type PlayableProjectionV1,
  type PlayableTargetActionProjectionV1,
} from "@wuming-town/sim-protocol";

import {
  mapBlueprint,
  mapBuildPayload,
  mapCell,
  mapCells,
  mapCommandBasis,
  mapEntity,
  mapOptionalReason,
  mapPlacementTargetRef,
  mapPrioritizePayload,
  mapReasons,
  mapReason,
  mapResourceCount,
  mapResourceRequirement,
  mapTarget,
} from "./playable-projection-mappers";

type PlayableBuildReadModel = NonNullable<PlayableReadModel["build"]>;
type PlayableJobMarkerReadModel = PlayableReadModel["jobMarkers"][number];
type PlayableLampActionReadModel = PlayableReadModel["lampAction"];
type PlayablePawnReadModel = PlayableReadModel["pawns"][number];
type PlayablePlacementReadModel = PlayableReadModel["placement"];

export function createPlayableProjection(readModel: PlayableReadModel): PlayableProjectionV1 {
  const commandBasis = mapCommandBasis(readModel.commandBasis);
  return {
    playableCommandReadModelVersion: readModel.playableCommandReadModelVersion,
    basis: {
      tick: readModel.basisTick,
      snapshotSequence: readModel.basisSnapshotSequence,
      worldHash: readModel.basisWorldHash,
      readModelHash: readModel.basisReadModelHash,
      contentManifestHash: readModel.contentManifestHash,
      targetVersion: readModel.targetVersion,
      mapVersion: readModel.mapVersion,
      reservationVersion: readModel.reservationVersion,
      jobVersion: readModel.jobVersion,
      commandBasis,
    },
    targets: [
      mapLampTarget(readModel.lampAction, readModel.jobMarkers, commandBasis),
      mapPlacementTarget(
        readModel.placement,
        readModel.build,
        commandBasis,
        readModel.targetVersion,
      ),
    ],
    placements: [mapPlacement(readModel.placement, commandBasis)],
    orders: mapOrders(readModel.jobMarkers),
    pawns: mapPawns(readModel.pawns),
    ...(readModel.build !== undefined ? { build: mapBuild(readModel.build) } : {}),
    lamps: [mapLamp(readModel.lampAction, readModel.jobMarkers)],
    resources: {
      materials: [
        mapResourceCount(
          readModel.resources.woodDefId,
          readModel.resources.woodAvailable,
          readModel.resources.woodReserved,
          readModel.resources.woodTotal,
        ),
        mapResourceCount(
          readModel.resources.stoneDefId,
          readModel.resources.stoneAvailable,
          readModel.resources.stoneReserved,
          readModel.resources.stoneTotal,
        ),
        mapResourceCount(
          readModel.resources.repairFrameDefId,
          readModel.resources.repairFrameAvailable,
          readModel.resources.repairFrameReserved,
          readModel.resources.repairFrameTotal,
        ),
      ],
    },
    alerts: mapReasons(readModel.alerts),
  };
}

function mapLampTarget(
  action: PlayableLampActionReadModel,
  markers: readonly PlayableJobMarkerReadModel[],
  commandBasis: CommandBasis,
): PlayableTargetActionProjectionV1 {
  const blockedReason = mapOptionalReason(action.disabledReason);
  return {
    target: mapTarget(action.target),
    targetState: readLampTargetState(markers, blockedReason),
    targetVersion: commandBasis.targetVersion ?? 0,
    actions: [
      {
        commandKind: PLAYER_COMMAND_KIND.PrioritizeLampWork,
        commandBasis,
        payload: mapPrioritizePayload(action.payloadTemplate),
        available: action.available,
        ...(blockedReason !== undefined ? { disabledReason: blockedReason } : {}),
      },
    ],
    ...(blockedReason !== undefined ? { blockedReason } : {}),
  };
}

function mapPlacementTarget(
  placement: PlayablePlacementReadModel,
  build: PlayableBuildReadModel | undefined,
  commandBasis: CommandBasis,
  targetVersion: number,
): PlayableTargetActionProjectionV1 {
  const blockedReason = mapOptionalReason(placement.disabledReason);
  return {
    target: mapPlacementTargetRef(placement),
    targetState: readPlacementTargetState(placement, build, blockedReason),
    targetVersion,
    actions: [mapPlacementCommand(placement, commandBasis)],
    ...(blockedReason !== undefined ? { blockedReason } : {}),
  };
}

function mapPlacement(
  placement: PlayablePlacementReadModel,
  commandBasis: CommandBasis,
): PlayablePlacementProjectionV1 {
  const blockedReason = mapOptionalReason(placement.disabledReason);
  return {
    blueprint: mapBlueprint(placement.blueprint),
    anchorCell: mapCell(placement.anchorCell),
    orientation: placement.orientation,
    orientationOptions: placement.orientationOptions,
    footprint: mapCells(placement.footprint),
    interactionCells: mapCells(placement.interactionCells),
    valid: placement.valid,
    command: mapPlacementCommand(placement, commandBasis),
    ...(blockedReason !== undefined ? { blockedReason } : {}),
  };
}

function mapPlacementCommand(
  placement: PlayablePlacementReadModel,
  commandBasis: CommandBasis,
): PlayableCommandTemplateV1 {
  const disabledReason = mapOptionalReason(placement.disabledReason);
  return {
    commandKind: PLAYER_COMMAND_KIND.QueueSimpleBuild,
    commandBasis,
    payload: mapBuildPayload(placement.payloadTemplate),
    available: placement.valid,
    ...(disabledReason !== undefined ? { disabledReason } : {}),
  };
}

function mapOrders(
  markers: readonly PlayableJobMarkerReadModel[],
): readonly PlayableOrderJobProjectionV1[] {
  const output: PlayableOrderJobProjectionV1[] = [];
  for (const marker of markers) {
    output.push({
      orderId: marker.orderId,
      commandId: marker.commandId,
      jobId: marker.jobId,
      jobKind: marker.jobKind,
      markerState: marker.markerState,
      ...(marker.owner !== undefined ? { owner: mapEntity(marker.owner) } : {}),
      target: mapTarget(marker.target),
      progressQ16: marker.progressQ16,
      requiredWork: marker.requiredWork,
      ...(marker.blockedReason !== undefined
        ? { blockedReason: mapReason(marker.blockedReason) }
        : {}),
    });
  }
  return output;
}

function mapPawns(pawns: readonly PlayablePawnReadModel[]): readonly PlayablePawnProjectionV1[] {
  const output: PlayablePawnProjectionV1[] = [];
  for (const pawn of pawns) {
    output.push({
      actor: mapEntity(pawn.actor),
      displayId: pawn.displayId,
      cellIndex: pawn.cellIndex,
      state: pawn.state,
      orderId: pawn.orderId,
      jobId: pawn.jobId,
      pathTargetCell: pawn.pathTargetCell,
      ...(pawn.blockedReason !== undefined ? { blockedReason: mapReason(pawn.blockedReason) } : {}),
    });
  }
  return output;
}

function mapBuild(build: PlayableBuildReadModel): PlayableBuildProjectionV1 {
  return {
    siteId: build.siteId,
    site: mapEntity(build.site),
    active: build.active,
    completed: build.completed,
    blueprintDefId: build.blueprintDefId,
    anchorCell: mapCell(build.anchorCell),
    interactionCells: mapCells(build.interactionCells),
    requiredMaterials: [
      mapResourceRequirement(
        build.requiredWoodDefId,
        build.requiredWood,
        build.deliveredWood,
        build.reservedWood,
        build.remainingWood,
      ),
      mapResourceRequirement(
        build.requiredStoneDefId,
        build.requiredStone,
        build.deliveredStone,
        build.reservedStone,
        build.remainingStone,
      ),
    ],
    buildProgressTicks: build.buildProgressTicks,
    buildRequiredTicks: build.buildRequiredTicks,
    lanternState: build.lanternState,
  };
}

function mapLamp(
  action: PlayableLampActionReadModel,
  markers: readonly PlayableJobMarkerReadModel[],
): PlayableLampProjectionV1 {
  const marker = readLampMarker(markers);
  const blockedReason = mapOptionalReason(marker?.blockedReason ?? action.disabledReason);
  return {
    target: mapTarget(action.target),
    state: readLampState(marker, blockedReason),
    reason: "dusk_lamp_gap",
    progressQ16: marker?.progressQ16 ?? 0,
    requiredWork: marker?.requiredWork ?? PLAYABLE_COMMAND_SLICE_LAMP_WORK_TICKS,
    ...(blockedReason !== undefined ? { blockedReason } : {}),
  };
}

function readLampTargetState(
  markers: readonly PlayableJobMarkerReadModel[],
  blockedReason: CommandBlockedReason | undefined,
): PlayableTargetActionProjectionV1["targetState"] {
  const marker = readLampMarker(markers);
  if (marker?.markerState === "completed") {
    return "completed";
  }
  if (blockedReason !== undefined) {
    return "blocked";
  }
  return marker === undefined ? "available" : "active";
}

function readPlacementTargetState(
  placement: PlayablePlacementReadModel,
  build: PlayableBuildReadModel | undefined,
  blockedReason: CommandBlockedReason | undefined,
): PlayableTargetActionProjectionV1["targetState"] {
  if (build?.completed === true) {
    return "completed";
  }
  if (build?.active === true) {
    return "active";
  }
  if (blockedReason !== undefined || !placement.valid) {
    return "blocked";
  }
  return "available";
}

function readLampMarker(
  markers: readonly PlayableJobMarkerReadModel[],
): PlayableJobMarkerReadModel | undefined {
  for (const marker of markers) {
    if (marker.jobKind === "lamp_refill") {
      return marker;
    }
  }
  return undefined;
}

function readLampState(
  marker: PlayableJobMarkerReadModel | undefined,
  blockedReason: CommandBlockedReason | undefined,
): PlayableLampProjectionV1["state"] {
  if (marker === undefined) {
    return blockedReason === undefined ? "gap" : "blocked";
  }
  if (marker.markerState === "completed") {
    return "completed";
  }
  if (marker.markerState === "blocked" || blockedReason !== undefined) {
    return "blocked";
  }
  return marker.markerState === "working" ? "working" : "queued";
}
