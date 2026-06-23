import { MAIN_TO_SIMULATION_MESSAGE_KIND } from "./constants";
import { readValidEnvelope, validateEnvelope } from "./envelope-validation";
import {
  validateDevCommandPayload,
  validateInitSessionPayload,
  validateLoadSessionPayload,
  validatePausePayload,
  validatePlayerCommandBatchPayload,
  validateRequestSavePayload,
  validateRequestUiDetailPayload,
  validateSetSpeedPayload,
  validateShutdownPayload,
} from "./payload-validation";
import type { MainMessageValidationResult } from "./types";
import type { ValidMainEnvelopeRecord } from "./validation-types";
import { isNonNegativeSafeInteger, isRecord } from "./validation-helpers";
import {
  acceptedMessage,
  invalidBoundary,
  rejectedPayload,
  rejectedReason,
} from "./validation-results";

export function validateMainToSimulationMessage(input: unknown): MainMessageValidationResult {
  if (!isRecord(input)) {
    return invalidBoundary("message envelope must be an object", "", 0);
  }

  const observedSessionId = typeof input.sessionId === "string" ? input.sessionId : "";
  const observedSequence = isNonNegativeSafeInteger(input.sequence) ? input.sequence : 0;

  const envelopeFailure = validateEnvelope(input);
  if (envelopeFailure !== undefined) {
    return {
      ok: false,
      reason: envelopeFailure,
      observedSessionId,
      observedSequence,
    };
  }

  const envelope = readValidEnvelope(input);

  if (envelope === undefined) {
    return invalidBoundary("message envelope could not be normalized after validation", "", 0);
  }

  return validateEnvelopePayload(envelope, observedSessionId, observedSequence);
}

function validateEnvelopePayload(
  envelope: ValidMainEnvelopeRecord,
  observedSessionId: string,
  observedSequence: number,
): MainMessageValidationResult {
  if (!isRecord(envelope.payload)) {
    return rejectedPayload("payload must be an object", observedSessionId, observedSequence);
  }

  switch (envelope.kind) {
    case MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession: {
      const payload = validateInitSessionPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession: {
      const payload = validateLoadSessionPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch: {
      const payload = validatePlayerCommandBatchPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed: {
      const payload = validateSetSpeedPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Pause: {
      const payload = validatePausePayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Pause,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail: {
      const payload = validateRequestUiDetailPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave: {
      const payload = validateRequestSavePayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand: {
      const payload = validateDevCommandPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand,
        payload: payload.payload,
      });
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown: {
      const payload = validateShutdownPayload(envelope.payload);
      if (!payload.ok) {
        return rejectedReason(payload.reason, observedSessionId, observedSequence);
      }

      return acceptedMessage({
        protocolVersion: envelope.protocolVersion,
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        sequence: envelope.sequence,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown,
        payload: payload.payload,
      });
    }
  }
}
