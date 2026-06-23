import { describe, expect, it } from "vitest";

import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  validateMainToSimulationMessage,
  type MainToSimulationMessage,
} from "./index";

const initMessage = {
  protocolVersion: SIM_PROTOCOL_VERSION,
  schemaVersion: SIM_SCHEMA_VERSION,
  sessionId: "session-a",
  sequence: 1,
  kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
  payload: {
    seed: "seed-0005",
    catalogVersion: "catalog-0001",
  },
} satisfies MainToSimulationMessage;

describe("validateMainToSimulationMessage", () => {
  it("accepts versioned InitSession envelopes", () => {
    const result = validateMainToSimulationMessage(initMessage);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.reason.detail);
    }

    expect(result.message).toStrictEqual(initMessage);
  });

  it("rejects unsupported protocol versions with structured reasons", () => {
    const result = validateMainToSimulationMessage({
      ...initMessage,
      protocolVersion: SIM_PROTOCOL_VERSION + 1,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedProtocolVersion,
      },
      observedSessionId: "session-a",
      observedSequence: 1,
    });
  });

  it("rejects unsupported schema versions with structured reasons", () => {
    const result = validateMainToSimulationMessage({
      ...initMessage,
      schemaVersion: SIM_SCHEMA_VERSION + 1,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedSchemaVersion,
      },
    });
  });

  it("rejects unknown message kinds before payload dispatch", () => {
    const result = validateMainToSimulationMessage({
      ...initMessage,
      kind: "StartTheWorld",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.UnknownMessageKind,
      },
    });
  });

  it("rejects unknown player command kinds without accepting the batch", () => {
    const result = validateMainToSimulationMessage({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "session-a",
      sequence: 2,
      kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
      payload: {
        commands: [
          {
            commandId: "command-a",
            kind: "TeleportWithoutRules",
          },
        ],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.UnknownCommandKind,
      },
    });
  });

  it("accepts supported player command batches", () => {
    const result = validateMainToSimulationMessage({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "session-a",
      sequence: 2,
      kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
      payload: {
        commands: [
          {
            commandId: "command-a",
            kind: PLAYER_COMMAND_KIND.Noop,
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
  });
});
