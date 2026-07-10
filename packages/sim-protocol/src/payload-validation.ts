import {
  GAME_SESSION_PROJECTION_VERSION,
  PLAYER_COMMAND_KIND,
  PLAYABLE_COMMAND_CONTRACT_VERSION,
  SIMULATION_PROTOCOL_REASON_CODE,
} from "./constants";
import { validateGameSessionProjectionRequest } from "./game-session-projection-validation";
import type { GameSessionProjectionRequestV1 } from "./game-session-projection";
import { isNonNegativeSafeInteger, isPlayerCommandKind, isRecord } from "./validation-helpers";

import type {
  DevCommandPayload,
  CellRef,
  CommandBasis,
  InitSessionPayload,
  LoadSessionPayload,
  PausePayload,
  PlayerCommand,
  PrioritizeLampWorkPayload,
  PlayerCommandBatchPayload,
  ProtocolRejection,
  QueueSimpleBuildPayload,
  RequestSavePayload,
  RequestUiDetailPayload,
  SetSpeedPayload,
  ShutdownPayload,
} from "./types";
import type { PayloadValidationResult, ProtocolInputRecord } from "./validation-types";

export function validateInitSessionPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<InitSessionPayload> {
  if (typeof payload.seed !== "string" || payload.seed.length === 0) {
    return invalidCommandShape("InitSession.seed must be a non-empty string");
  }

  if (typeof payload.catalogVersion !== "string" || payload.catalogVersion.length === 0) {
    return invalidCommandShape("InitSession.catalogVersion must be a non-empty string");
  }

  let projectionRequest: GameSessionProjectionRequestV1 | undefined;
  if (payload["projectionRequest"] !== undefined) {
    const validation = validateGameSessionProjectionRequest(payload["projectionRequest"]);
    if (!validation.ok) {
      return validation;
    }
    projectionRequest = {
      kind: "game_session",
      version: GAME_SESSION_PROJECTION_VERSION,
    };
  }

  return {
    ok: true,
    payload: {
      seed: payload.seed,
      catalogVersion: payload.catalogVersion,
      ...(projectionRequest === undefined ? {} : { projectionRequest }),
    },
  };
}

export function validateLoadSessionPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<LoadSessionPayload> {
  if (typeof payload.saveId !== "string" || payload.saveId.length === 0) {
    return invalidCommandShape("LoadSession.saveId must be a non-empty string");
  }

  if (!isNonNegativeSafeInteger(payload.checkpointSequence)) {
    return invalidCommandShape(
      "LoadSession.checkpointSequence must be a non-negative safe integer",
    );
  }

  return {
    ok: true,
    payload: {
      saveId: payload.saveId,
      checkpointSequence: payload.checkpointSequence,
    },
  };
}

export function validatePlayerCommandBatchPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<PlayerCommandBatchPayload> {
  if (!Array.isArray(payload.commands)) {
    return invalidCommandShape("PlayerCommandBatch.commands must be an array");
  }

  const commands: PlayerCommand[] = [];

  for (const command of payload.commands) {
    const commandResult = validatePlayerCommand(command);
    if (!commandResult.ok) {
      return commandResult;
    }

    commands.push(commandResult.command);
  }

  return {
    ok: true,
    payload: {
      commands,
    },
  };
}

export function validateSetSpeedPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<SetSpeedPayload> {
  if (payload.speed !== 0 && payload.speed !== 1 && payload.speed !== 2 && payload.speed !== 3) {
    return invalidCommandShape("SetSpeed.speed must be 0, 1, 2, or 3");
  }

  return {
    ok: true,
    payload: {
      speed: payload.speed,
    },
  };
}

export function validatePausePayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<PausePayload> {
  if (typeof payload.paused !== "boolean") {
    return invalidCommandShape("Pause.paused must be a boolean");
  }

  return {
    ok: true,
    payload: {
      paused: payload.paused,
    },
  };
}

export function validateRequestUiDetailPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<RequestUiDetailPayload> {
  if (!isRecord(payload.subject)) {
    return invalidCommandShape("RequestUiDetail.subject must be an object");
  }

  if (payload.subject.kind === "session") {
    return {
      ok: true,
      payload: {
        subject: {
          kind: "session",
        },
      },
    };
  }

  if (
    payload.subject.kind === "entity" &&
    typeof payload.subject.entityId === "string" &&
    payload.subject.entityId.length > 0
  ) {
    return {
      ok: true,
      payload: {
        subject: {
          kind: "entity",
          entityId: payload.subject.entityId,
        },
      },
    };
  }

  return invalidCommandShape("RequestUiDetail.subject must target session or a non-empty entityId");
}

export function validateRequestSavePayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<RequestSavePayload> {
  if (payload.reason !== "manual" && payload.reason !== "autosave") {
    return invalidCommandShape("RequestSave.reason must be manual or autosave");
  }

  return {
    ok: true,
    payload: {
      reason: payload.reason,
    },
  };
}

export function validateDevCommandPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<DevCommandPayload> {
  if (payload.command !== "echo") {
    return {
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.UnknownCommandKind,
        detail: "DevCommand.command is not supported by this Worker build",
      },
    };
  }

  if (typeof payload.text !== "string") {
    return invalidCommandShape("DevCommand.text must be a string");
  }

  return {
    ok: true,
    payload: {
      command: payload.command,
      text: payload.text,
    },
  };
}

export function validateShutdownPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<ShutdownPayload> {
  if (payload.reason !== "client-request") {
    return invalidCommandShape("Shutdown.reason must be client-request");
  }

  return {
    ok: true,
    payload: {
      reason: payload.reason,
    },
  };
}

type PlayerCommandValidationResult =
  | {
      readonly ok: true;
      readonly command: PlayerCommand;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

function validatePlayerCommand(input: unknown): PlayerCommandValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
        detail: "player command must be an object",
      },
    };
  }

  if (typeof input.commandId !== "string" || input.commandId.length === 0) {
    return {
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
        detail: "player command commandId must be a non-empty string",
      },
    };
  }

  if (!isPlayerCommandKind(input.kind)) {
    return {
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.UnknownCommandKind,
        detail: "player command kind is not supported by this Worker build",
      },
    };
  }

  if (input.kind === PLAYER_COMMAND_KIND.PrioritizeLampWork) {
    const basis = validateCommandBasis(input.basis);
    if (!basis.ok) {
      return basis;
    }

    const payload = validatePrioritizeLampWorkPayload(input.payload);
    if (!payload.ok) {
      return payload;
    }

    return {
      ok: true,
      command: {
        commandId: input.commandId,
        kind: PLAYER_COMMAND_KIND.PrioritizeLampWork,
        payload: payload.payload,
        basis: basis.basis,
      },
    };
  }

  if (input.kind === PLAYER_COMMAND_KIND.QueueSimpleBuild) {
    const basis = validateCommandBasis(input.basis);
    if (!basis.ok) {
      return basis;
    }

    const payload = validateQueueSimpleBuildPayload(input.payload);
    if (!payload.ok) {
      return payload;
    }

    return {
      ok: true,
      command: {
        commandId: input.commandId,
        kind: PLAYER_COMMAND_KIND.QueueSimpleBuild,
        payload: payload.payload,
        basis: basis.basis,
      },
    };
  }

  return {
    ok: true,
    command: {
      commandId: input.commandId,
      kind: input.kind,
    },
  };
}

export const SUPPORTED_PLAYER_COMMAND_KINDS: readonly string[] = [
  PLAYER_COMMAND_KIND.Noop,
  PLAYER_COMMAND_KIND.Echo,
  PLAYER_COMMAND_KIND.PrioritizeLampWork,
  PLAYER_COMMAND_KIND.QueueSimpleBuild,
];

type BasisValidationResult =
  | {
      readonly ok: true;
      readonly basis: CommandBasis;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

type PrioritizeLampWorkPayloadValidationResult =
  | {
      readonly ok: true;
      readonly payload: PrioritizeLampWorkPayload;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

type QueueSimpleBuildPayloadValidationResult =
  | {
      readonly ok: true;
      readonly payload: QueueSimpleBuildPayload;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

function validateCommandBasis(input: unknown): BasisValidationResult {
  if (!isRecord(input)) {
    return invalidCommandShape("player command basis must be an object");
  }

  if (input.playableCommandContractVersion !== PLAYABLE_COMMAND_CONTRACT_VERSION) {
    return invalidCommandShape("player command basis has unsupported playable contract version");
  }

  if (
    !isNonNegativeSafeInteger(input.basisTick) ||
    !isNonNegativeSafeInteger(input.basisSnapshotSequence)
  ) {
    return invalidCommandShape(
      "player command basis tick and snapshot sequence must be safe integers",
    );
  }

  if (
    typeof input.basisReadModelHash !== "string" ||
    input.basisReadModelHash.length === 0 ||
    typeof input.contentManifestHash !== "string" ||
    input.contentManifestHash.length === 0
  ) {
    return invalidCommandShape("player command basis hashes must be non-empty strings");
  }

  const optionalVersions = [
    input.targetVersion,
    input.mapVersion,
    input.reservationVersion,
    input.jobVersion,
  ];
  for (const version of optionalVersions) {
    if (version !== undefined && !isNonNegativeSafeInteger(version)) {
      return invalidCommandShape("player command basis optional versions must be safe integers");
    }
  }

  const basis: CommandBasis = {
    playableCommandContractVersion: PLAYABLE_COMMAND_CONTRACT_VERSION,
    basisTick: input.basisTick,
    basisSnapshotSequence: input.basisSnapshotSequence,
    basisReadModelHash: input.basisReadModelHash,
    contentManifestHash: input.contentManifestHash,
  };
  const targetVersion = input.targetVersion;
  const mapVersion = input.mapVersion;
  const reservationVersion = input.reservationVersion;
  const jobVersion = input.jobVersion;

  return {
    ok: true,
    basis: {
      ...basis,
      ...(typeof targetVersion === "number" ? { targetVersion } : {}),
      ...(typeof mapVersion === "number" ? { mapVersion } : {}),
      ...(typeof reservationVersion === "number" ? { reservationVersion } : {}),
      ...(typeof jobVersion === "number" ? { jobVersion } : {}),
    },
  };
}

function validatePrioritizeLampWorkPayload(
  input: unknown,
): PrioritizeLampWorkPayloadValidationResult {
  if (!isRecord(input)) {
    return invalidCommandShape("PrioritizeLampWork.payload must be an object");
  }

  if (
    input.requestedAction !== "auto" &&
    input.requestedAction !== "refill_lamp" &&
    input.requestedAction !== "repair_lamp" &&
    input.requestedAction !== "complete_lamp_build_site"
  ) {
    return invalidCommandShape("PrioritizeLampWork.requestedAction is unsupported");
  }

  const priorityBand = validatePriorityBand(input.priorityBand);
  if (priorityBand === undefined) {
    return invalidCommandShape("PrioritizeLampWork.priorityBand must be 1, 2, or 3");
  }

  const target = validateLampTarget(input.target);
  if (!target.ok) {
    return target;
  }

  return {
    ok: true,
    payload: {
      target: target.target,
      requestedAction: input.requestedAction,
      priorityBand,
    },
  };
}

function validateQueueSimpleBuildPayload(input: unknown): QueueSimpleBuildPayloadValidationResult {
  if (!isRecord(input)) {
    return invalidCommandShape("QueueSimpleBuild.payload must be an object");
  }

  if (!isRecord(input.blueprint)) {
    return invalidCommandShape("QueueSimpleBuild.blueprint must be an object");
  }

  if (
    input.blueprint.kind !== "simple_lamp_post" &&
    input.blueprint.kind !== "simple_repair_frame"
  ) {
    return invalidCommandShape("QueueSimpleBuild.blueprint.kind is unsupported");
  }

  if (!isNonNegativeSafeInteger(input.blueprint.blueprintDefId)) {
    return invalidCommandShape("QueueSimpleBuild.blueprint.blueprintDefId must be a safe integer");
  }

  const anchorCell = validateCellRef(input.anchorCell);
  if (!anchorCell.ok) {
    return anchorCell;
  }

  if (
    input.orientation !== 0 &&
    input.orientation !== 1 &&
    input.orientation !== 2 &&
    input.orientation !== 3
  ) {
    return invalidCommandShape("QueueSimpleBuild.orientation must be 0, 1, 2, or 3");
  }

  const priorityBand = validatePriorityBand(input.priorityBand);
  if (priorityBand === undefined) {
    return invalidCommandShape("QueueSimpleBuild.priorityBand must be 1, 2, or 3");
  }

  return {
    ok: true,
    payload: {
      blueprint: {
        kind: input.blueprint.kind,
        blueprintDefId: input.blueprint.blueprintDefId,
      },
      anchorCell: anchorCell.cell,
      orientation: input.orientation,
      priorityBand,
    },
  };
}

type LampTargetValidationResult =
  | {
      readonly ok: true;
      readonly target: PrioritizeLampWorkPayload["target"];
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

function validateLampTarget(input: unknown): LampTargetValidationResult {
  if (!isRecord(input)) {
    return invalidCommandShape("PrioritizeLampWork.target must be an object");
  }

  if (input.kind === "lamp") {
    const entity = validateEntityRef(input.entity);
    if (!entity.ok) {
      return entity;
    }
    return { ok: true, target: { kind: "lamp", entity: entity.entity } };
  }

  if (input.kind === "lamp_gap") {
    if (typeof input.gapId !== "string" || input.gapId.length === 0) {
      return invalidCommandShape("PrioritizeLampWork.target.gapId must be non-empty");
    }

    const anchorCell = validateCellRef(input.anchorCell);
    if (!anchorCell.ok) {
      return anchorCell;
    }
    return {
      ok: true,
      target: { kind: "lamp_gap", gapId: input.gapId, anchorCell: anchorCell.cell },
    };
  }

  if (input.kind === "build_site") {
    if (!isNonNegativeSafeInteger(input.siteId)) {
      return invalidCommandShape("PrioritizeLampWork.target.siteId must be a safe integer");
    }

    const site = validateEntityRef(input.site);
    if (!site.ok) {
      return site;
    }
    return { ok: true, target: { kind: "build_site", siteId: input.siteId, site: site.entity } };
  }

  return invalidCommandShape("PrioritizeLampWork.target.kind is unsupported");
}

type EntityRefValidationResult =
  | {
      readonly ok: true;
      readonly entity: { readonly index: number; readonly generation: number };
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

function validateEntityRef(input: unknown): EntityRefValidationResult {
  if (!isRecord(input)) {
    return invalidCommandShape("entity ref must be an object");
  }

  if (!isNonNegativeSafeInteger(input.index) || !isNonNegativeSafeInteger(input.generation)) {
    return invalidCommandShape("entity ref index and generation must be safe integers");
  }

  return { ok: true, entity: { index: input.index, generation: input.generation } };
}

type CellRefValidationResult =
  | {
      readonly ok: true;
      readonly cell: CellRef;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };

function validateCellRef(input: unknown): CellRefValidationResult {
  if (!isRecord(input)) {
    return invalidCommandShape("cell ref must be an object");
  }

  if (
    !isNonNegativeSafeInteger(input.x) ||
    !isNonNegativeSafeInteger(input.y) ||
    !isNonNegativeSafeInteger(input.cellIndex)
  ) {
    return invalidCommandShape("cell ref x, y and cellIndex must be safe integers");
  }

  return { ok: true, cell: { x: input.x, y: input.y, cellIndex: input.cellIndex } };
}

function validatePriorityBand(input: unknown): 1 | 2 | 3 | undefined {
  if (input === 1 || input === 2 || input === 3) {
    return input;
  }

  return undefined;
}

function invalidCommandShape(detail: string): {
  readonly ok: false;
  readonly reason: ProtocolRejection;
} {
  return {
    ok: false,
    reason: {
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail,
    },
  };
}
