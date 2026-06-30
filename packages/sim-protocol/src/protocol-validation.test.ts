import { describe, expect, it } from "vitest";

import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  validateMainToSimulationMessage,
  type MainToSimulationMessage,
  type UiDeltaMessage,
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

  it("accepts playable lamp and simple-build command payloads", () => {
    const result = validateMainToSimulationMessage({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "session-a",
      sequence: 2,
      kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
      payload: {
        commands: [
          {
            commandId: "lamp-command",
            kind: PLAYER_COMMAND_KIND.PrioritizeLampWork,
            basis: commandBasis(),
            payload: {
              target: {
                kind: "lamp_gap",
                gapId: "lamp-gap-0",
                anchorCell: { x: 12, y: 7, cellIndex: 124 },
              },
              requestedAction: "auto",
              priorityBand: 1,
            },
          },
          {
            commandId: "build-command",
            kind: PLAYER_COMMAND_KIND.QueueSimpleBuild,
            basis: commandBasis(),
            payload: {
              blueprint: { kind: "simple_lamp_post", blueprintDefId: 4 },
              anchorCell: { x: 12, y: 7, cellIndex: 124 },
              orientation: 0,
              priorityBand: 1,
            },
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects playable commands without reviewed basis data", () => {
    const result = validateMainToSimulationMessage({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "session-a",
      sequence: 2,
      kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
      payload: {
        commands: [
          {
            commandId: "lamp-command",
            kind: PLAYER_COMMAND_KIND.PrioritizeLampWork,
            payload: {
              target: {
                kind: "lamp_gap",
                gapId: "lamp-gap-0",
                anchorCell: { x: 12, y: 7, cellIndex: 124 },
              },
              requestedAction: "auto",
              priorityBand: 1,
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      },
    });
  });

  it("exposes a versioned playable projection on UiDelta payloads", () => {
    const message = {
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "session-a",
      sequence: 3,
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      payload: {
        tick: 0,
        summaries: [],
        readOnly: true,
        playable: {
          playableCommandReadModelVersion: 1,
          basis: {
            tick: 0,
            snapshotSequence: 0,
            worldHash: "0xworld",
            readModelHash: "0xread",
            contentManifestHash: "0x0150015a",
            targetVersion: 0,
            mapVersion: 0,
            reservationVersion: 0,
            jobVersion: 0,
            commandBasis: commandBasis(),
          },
          targets: [],
          placements: [],
          orders: [],
          pawns: [],
          lamps: [],
          resources: { materials: [] },
          alerts: [],
        },
      },
    } satisfies UiDeltaMessage;

    expect(message.payload.playable.playableCommandReadModelVersion).toBe(1);
  });
});

function commandBasis(): {
  readonly playableCommandContractVersion: 1;
  readonly basisTick: number;
  readonly basisSnapshotSequence: number;
  readonly basisReadModelHash: string;
  readonly contentManifestHash: string;
} {
  return {
    playableCommandContractVersion: 1,
    basisTick: 0,
    basisSnapshotSequence: 0,
    basisReadModelHash: "0xinitial",
    contentManifestHash: "0x0150015a",
  };
}
