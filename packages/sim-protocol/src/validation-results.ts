import { SIMULATION_PROTOCOL_REASON_CODE } from "./constants";
import type {
  MainMessageValidationResult,
  MainToSimulationMessage,
  ProtocolRejection,
} from "./types";
import type { PayloadValidationResult } from "./validation-types";

export function acceptedMessage(message: MainToSimulationMessage): MainMessageValidationResult {
  return {
    ok: true,
    message,
  };
}

export function rejectedPayload(
  detail: string,
  observedSessionId: string,
  observedSequence: number,
): MainMessageValidationResult {
  return rejectedReason(
    {
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail,
    },
    observedSessionId,
    observedSequence,
  );
}

export function rejectedReason(
  reason: ProtocolRejection,
  observedSessionId: string,
  observedSequence: number,
): MainMessageValidationResult {
  return {
    ok: false,
    reason,
    observedSessionId,
    observedSequence,
  };
}

export function invalidBoundary(
  detail: string,
  observedSessionId: string,
  observedSequence: number,
): MainMessageValidationResult {
  return {
    ok: false,
    reason: {
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail,
    },
    observedSessionId,
    observedSequence,
  };
}

export function invalidPayload<TPayload>(detail: string): PayloadValidationResult<TPayload> {
  return {
    ok: false,
    reason: {
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail,
    },
  };
}
