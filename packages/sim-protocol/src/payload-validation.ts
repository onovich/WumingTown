import { PLAYER_COMMAND_KIND, SIMULATION_PROTOCOL_REASON_CODE } from "./constants";
import { isNonNegativeSafeInteger, isPlayerCommandKind, isRecord } from "./validation-helpers";
import { invalidPayload } from "./validation-results";
import type {
  DevCommandPayload,
  InitSessionPayload,
  LoadSessionPayload,
  PausePayload,
  PlayerCommand,
  PlayerCommandBatchPayload,
  ProtocolRejection,
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
    return invalidPayload("InitSession.seed must be a non-empty string");
  }

  if (typeof payload.catalogVersion !== "string" || payload.catalogVersion.length === 0) {
    return invalidPayload("InitSession.catalogVersion must be a non-empty string");
  }

  return {
    ok: true,
    payload: {
      seed: payload.seed,
      catalogVersion: payload.catalogVersion,
    },
  };
}

export function validateLoadSessionPayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<LoadSessionPayload> {
  if (typeof payload.saveId !== "string" || payload.saveId.length === 0) {
    return invalidPayload("LoadSession.saveId must be a non-empty string");
  }

  if (!isNonNegativeSafeInteger(payload.checkpointSequence)) {
    return invalidPayload("LoadSession.checkpointSequence must be a non-negative safe integer");
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
    return invalidPayload("PlayerCommandBatch.commands must be an array");
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
    return invalidPayload("SetSpeed.speed must be 0, 1, 2, or 3");
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
    return invalidPayload("Pause.paused must be a boolean");
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
    return invalidPayload("RequestUiDetail.subject must be an object");
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

  return invalidPayload("RequestUiDetail.subject must target session or a non-empty entityId");
}

export function validateRequestSavePayload(
  payload: ProtocolInputRecord,
): PayloadValidationResult<RequestSavePayload> {
  if (payload.reason !== "manual" && payload.reason !== "autosave") {
    return invalidPayload("RequestSave.reason must be manual or autosave");
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
    return invalidPayload("DevCommand.text must be a string");
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
    return invalidPayload("Shutdown.reason must be client-request");
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
];
