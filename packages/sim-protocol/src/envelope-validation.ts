import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
} from "./constants";
import { isMainMessageKind, isPositiveSafeInteger } from "./validation-helpers";
import type { ProtocolRejection } from "./types";
import type { ProtocolInputRecord, ValidMainEnvelopeRecord } from "./validation-types";

export function validateEnvelope(input: ProtocolInputRecord): ProtocolRejection | undefined {
  if (input.protocolVersion !== SIM_PROTOCOL_VERSION) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedProtocolVersion,
      detail: "protocolVersion is not supported by this Worker build",
    };
  }

  if (input.schemaVersion !== SIM_SCHEMA_VERSION) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedSchemaVersion,
      detail: "schemaVersion is not supported by this Worker build",
    };
  }

  if (typeof input.sessionId !== "string" || input.sessionId.length === 0) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail: "sessionId must be a non-empty string",
    };
  }

  if (!isPositiveSafeInteger(input.sequence)) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail: "sequence must be a positive safe integer",
    };
  }

  if (!isMainMessageKind(input.kind)) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.UnknownMessageKind,
      detail: "message kind is not part of the main-to-simulation protocol",
    };
  }

  return undefined;
}

export function readValidEnvelope(input: ProtocolInputRecord): ValidMainEnvelopeRecord | undefined {
  if (
    input.protocolVersion === SIM_PROTOCOL_VERSION &&
    input.schemaVersion === SIM_SCHEMA_VERSION &&
    typeof input.sessionId === "string" &&
    isPositiveSafeInteger(input.sequence) &&
    isMainMessageKind(input.kind)
  ) {
    return {
      protocolVersion: input.protocolVersion,
      schemaVersion: input.schemaVersion,
      sessionId: input.sessionId,
      sequence: input.sequence,
      kind: input.kind,
      payload: input.payload,
    };
  }

  return undefined;
}

export function isSessionStartKind(kind: string): boolean {
  return (
    kind === MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession ||
    kind === MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession
  );
}
