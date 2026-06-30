import type { PlayableCommandBasis, PlayableReadModel } from "@wuming-town/sim-core";
import type {
  CellRef,
  CommandBasis,
  CommandBlockedReason,
  CommandTargetRef,
  PlayableResourceCountProjectionV1,
  PlayableResourceRequirementProjectionV1,
  PrioritizeLampWorkPayload,
  ProtocolEntityRef,
  QueueSimpleBuildPayload,
} from "@wuming-town/sim-protocol";

type PlayableBlockedReason = PlayableReadModel["alerts"][number];
type PlayableCommandTarget = PlayableReadModel["jobMarkers"][number]["target"];
type PlayableLampActionReadModel = PlayableReadModel["lampAction"];
type PlayablePlacementReadModel = PlayableReadModel["placement"];

export function mapCommandBasis(basis: PlayableCommandBasis): CommandBasis {
  return {
    playableCommandContractVersion: basis.playableCommandContractVersion,
    basisTick: basis.basisTick,
    basisSnapshotSequence: basis.basisSnapshotSequence,
    basisReadModelHash: basis.basisReadModelHash,
    contentManifestHash: basis.contentManifestHash,
    ...(basis.targetVersion !== undefined ? { targetVersion: basis.targetVersion } : {}),
    ...(basis.mapVersion !== undefined ? { mapVersion: basis.mapVersion } : {}),
    ...(basis.reservationVersion !== undefined
      ? { reservationVersion: basis.reservationVersion }
      : {}),
    ...(basis.jobVersion !== undefined ? { jobVersion: basis.jobVersion } : {}),
  };
}

export function mapPrioritizePayload(
  payload: PlayableLampActionReadModel["payloadTemplate"],
): PrioritizeLampWorkPayload {
  return {
    target: mapPrioritizeTarget(payload.target),
    requestedAction: payload.requestedAction,
    priorityBand: payload.priorityBand,
  };
}

export function mapBuildPayload(
  payload: PlayablePlacementReadModel["payloadTemplate"],
): QueueSimpleBuildPayload {
  return {
    blueprint: mapBlueprint(payload.blueprint),
    anchorCell: mapCell(payload.anchorCell),
    orientation: payload.orientation,
    priorityBand: payload.priorityBand,
  };
}

export function mapPlacementTargetRef(placement: PlayablePlacementReadModel): CommandTargetRef {
  return {
    kind: "build_cell",
    anchorCell: mapCell(placement.anchorCell),
    blueprintDefId: placement.blueprint.blueprintDefId,
  };
}

export function mapTarget(target: PlayableCommandTarget): CommandTargetRef {
  if (target.kind === "lamp") {
    return { kind: "lamp", entity: mapEntity(target.entity) };
  }
  if (target.kind === "build_site") {
    return { kind: "build_site", siteId: target.siteId, site: mapEntity(target.site) };
  }
  if (target.kind === "build_cell") {
    return {
      kind: "build_cell",
      anchorCell: mapCell(target.anchorCell),
      blueprintDefId: target.blueprintDefId,
    };
  }
  return { kind: "lamp_gap", gapId: target.gapId, anchorCell: mapCell(target.anchorCell) };
}

export function mapReason(reason: PlayableBlockedReason): CommandBlockedReason {
  return {
    code: reason.code,
    source: reason.source,
    ...(reason.target !== undefined ? { target: mapTarget(reason.target) } : {}),
    ...(reason.actor !== undefined ? { actor: mapEntity(reason.actor) } : {}),
    ...(reason.requirement !== undefined
      ? {
          requirement: {
            defId: reason.requirement.defId,
            requiredAmount: reason.requirement.requiredAmount,
            availableAmount: reason.requirement.availableAmount,
            reservedAmount: reason.requirement.reservedAmount,
          },
        }
      : {}),
    ...(reason.basis !== undefined
      ? {
          basis: {
            ...(reason.basis.expectedTick !== undefined
              ? { expectedTick: reason.basis.expectedTick }
              : {}),
            ...(reason.basis.observedTick !== undefined
              ? { observedTick: reason.basis.observedTick }
              : {}),
            ...(reason.basis.expectedReadModelHash !== undefined
              ? { expectedReadModelHash: reason.basis.expectedReadModelHash }
              : {}),
            ...(reason.basis.observedReadModelHash !== undefined
              ? { observedReadModelHash: reason.basis.observedReadModelHash }
              : {}),
            ...(reason.basis.expectedVersion !== undefined
              ? { expectedVersion: reason.basis.expectedVersion }
              : {}),
            ...(reason.basis.observedVersion !== undefined
              ? { observedVersion: reason.basis.observedVersion }
              : {}),
          },
        }
      : {}),
    ...(reason.policy !== undefined
      ? {
          policy: {
            policyId: reason.policy.policyId,
            reasonCode: reason.policy.reasonCode,
          },
        }
      : {}),
    ...(reason.candidateCounts !== undefined
      ? {
          candidateCounts: {
            workerCandidates: reason.candidateCounts.workerCandidates,
            visitedCandidates: reason.candidateCounts.visitedCandidates,
            selectedCandidates: reason.candidateCounts.selectedCandidates,
            candidateCap: reason.candidateCounts.candidateCap,
            candidateCapHit: reason.candidateCounts.candidateCapHit,
            pathRequests: reason.candidateCounts.pathRequests,
          },
        }
      : {}),
  };
}

export function mapReasons(
  reasons: readonly PlayableBlockedReason[],
): readonly CommandBlockedReason[] {
  const output: CommandBlockedReason[] = [];
  for (const reason of reasons) {
    output.push(mapReason(reason));
  }
  return output;
}

export function mapOptionalReason(
  reason: PlayableBlockedReason | undefined,
): CommandBlockedReason | undefined {
  return reason === undefined ? undefined : mapReason(reason);
}

export function mapResourceRequirement(
  defId: number,
  requiredAmount: number,
  deliveredAmount: number,
  reservedAmount: number,
  remainingAmount: number,
): PlayableResourceRequirementProjectionV1 {
  return {
    defId,
    requiredAmount,
    deliveredAmount,
    reservedAmount,
    remainingAmount,
  };
}

export function mapResourceCount(
  defId: number,
  availableAmount: number,
  reservedAmount: number,
  totalAmount: number,
): PlayableResourceCountProjectionV1 {
  return {
    defId,
    availableAmount,
    reservedAmount,
    totalAmount,
  };
}

export function mapEntity(entity: ProtocolEntityRef): ProtocolEntityRef {
  return {
    index: entity.index,
    generation: entity.generation,
  };
}

export function mapCell(cell: CellRef): CellRef {
  return {
    x: cell.x,
    y: cell.y,
    cellIndex: cell.cellIndex,
  };
}

export function mapCells(cells: readonly CellRef[]): readonly CellRef[] {
  const output: CellRef[] = [];
  for (const cell of cells) {
    output.push(mapCell(cell));
  }
  return output;
}

export function mapBlueprint(
  blueprint: PlayablePlacementReadModel["blueprint"],
): QueueSimpleBuildPayload["blueprint"] {
  if (blueprint.kind === "simple_repair_frame") {
    return { kind: "simple_repair_frame", blueprintDefId: blueprint.blueprintDefId };
  }
  return { kind: "simple_lamp_post", blueprintDefId: blueprint.blueprintDefId };
}

function mapPrioritizeTarget(
  target: PlayableLampActionReadModel["payloadTemplate"]["target"],
): PrioritizeLampWorkPayload["target"] {
  if (target.kind === "lamp") {
    return { kind: "lamp", entity: mapEntity(target.entity) };
  }
  if (target.kind === "build_site") {
    return { kind: "build_site", siteId: target.siteId, site: mapEntity(target.site) };
  }
  return { kind: "lamp_gap", gapId: target.gapId, anchorCell: mapCell(target.anchorCell) };
}
