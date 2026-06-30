import { describe, expect, it } from "vitest";

import {
  PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
  createPlayableAdvanceCommandId,
  createPlayableCommandSliceRuntime,
  type PlayableCommandBasis,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type CommandResultMessage,
  type MainToSimulationMessage,
  type PlayerCommand,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import { createSimulationWorker } from "./index";

describe("WM-0150 Simulation Worker playable command slice", () => {
  it("emits schema-v2 batch rejection fields for invalid player command batches", () => {
    const worker = createSimulationWorker();
    const rejected = commandResult(worker.receive(invalidPlayerCommandBatch()));

    expect(rejected.payload).toMatchObject({
      inReplyToSequence: 1,
      accepted: false,
      reason: { code: SIMULATION_PROTOCOL_REASON_CODE.UnknownCommandKind },
      batchAccepted: false,
      batchReason: { code: SIMULATION_PROTOCOL_REASON_CODE.UnknownCommandKind },
      commandResults: [],
    });
  });

  it("accepts playable commands into authoritative jobs and projects pawn/build progress", () => {
    const worker = createSimulationWorker();
    const mirror = createPlayableCommandSliceRuntime();

    expect(uiDelta(worker.receive(initSession(1))).payload).toMatchObject({
      scenarioId: PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
      readOnly: true,
      playable: {
        playableCommandReadModelVersion: 1,
        basis: {
          tick: 0,
          commandBasis: {
            playableCommandContractVersion: 1,
          },
        },
        targets: [
          {
            target: { kind: "lamp_gap", gapId: "lamp-gap-0" },
            actions: [{ commandKind: PLAYER_COMMAND_KIND.PrioritizeLampWork, available: true }],
          },
          {
            target: { kind: "build_cell", blueprintDefId: 4 },
            actions: [{ commandKind: PLAYER_COMMAND_KIND.QueueSimpleBuild, available: true }],
          },
        ],
        placements: [
          {
            valid: true,
            footprint: [{ x: 12, y: 7, cellIndex: 124 }],
          },
        ],
      },
    });

    const lampResult = commandResult(
      worker.receive(commandBatch(2, [lampCommand("lamp-worker", mirror.readCommandBasis())])),
    );
    mirror.applyCommand(lampCommand("lamp-worker", mirror.readCommandBasis()), 0);

    expect(lampResult.payload).toMatchObject({
      accepted: true,
      batchAccepted: true,
      commandResults: [
        {
          commandId: "lamp-worker",
          status: "accepted",
          initialState: "claimed",
          job: { jobId: 0, jobKind: "lamp_refill" },
        },
      ],
    });

    worker.receive(commandBatch(3, [advanceCommand(45)]));
    mirror.advanceTo(45);
    expect(
      uiDelta(worker.receive(commandBatch(4, [advanceCommand(45)]))).payload.summaries,
    ).toContainEqual(expect.stringContaining("wm0150:job:lamp-priority-0;state=completed"));

    const buildResult = commandResult(
      worker.receive(commandBatch(5, [buildCommand("build-worker", mirror.readCommandBasis())])),
    );
    mirror.applyCommand(buildCommand("build-worker", mirror.readCommandBasis()), 0);
    worker.receive(commandBatch(6, [advanceCommand(220)]));

    expect(buildResult.payload.commandResults[0]).toMatchObject({
      commandId: "build-worker",
      status: "accepted",
      job: { jobId: 1, jobKind: "build_site_delivery" },
    });
    expect(
      uiDelta(worker.receive(commandBatch(7, [advanceCommand(220)]))).payload.summaries,
    ).toContainEqual(expect.stringContaining("wm0150:build:site=0;completed=true"));
    const detailProjection = uiDelta(worker.receive(requestUiDetail(8))).payload.playable;
    expect(detailProjection).toMatchObject({
      basis: {
        tick: 220,
      },
      build: {
        siteId: 0,
        completed: true,
        requiredMaterials: [
          { defId: 1, requiredAmount: 6, deliveredAmount: 6 },
          { defId: 2, requiredAmount: 2, deliveredAmount: 2 },
        ],
      },
      orders: [
        {
          orderId: "lamp-priority-0",
          markerState: "completed",
        },
        {
          orderId: "simple-build-0",
          markerState: "completed",
        },
      ],
      pawns: [
        { displayId: "pawn-0", state: "completed" },
        { displayId: "pawn-1", state: "completed" },
      ],
      lamps: [
        {
          target: { kind: "lamp_gap", gapId: "lamp-gap-0" },
          state: "completed",
        },
      ],
    });
  });
});

function initSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-wm0150",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "5",
      catalogVersion: PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
    },
  };
}

function commandBatch(
  sequence: number,
  commands: readonly PlayerCommand[],
): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-wm0150",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands,
    },
  };
}

function invalidPlayerCommandBatch(): unknown {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-wm0150",
    sequence: 1,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [{ commandId: "invalid-command", kind: "TeleportWithoutRules" }],
    },
  };
}

function requestUiDetail(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-wm0150",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
    payload: {
      subject: { kind: "session" },
    },
  };
}

function lampCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): {
  readonly commandId: string;
  readonly kind: typeof PLAYER_COMMAND_KIND.PrioritizeLampWork;
  readonly basis: PlayableCommandBasis;
  readonly payload: {
    readonly target: {
      readonly kind: "lamp_gap";
      readonly gapId: "lamp-gap-0";
      readonly anchorCell: { readonly x: 12; readonly y: 7; readonly cellIndex: 124 };
    };
    readonly requestedAction: "auto";
    readonly priorityBand: 1;
  };
} {
  return {
    commandId,
    kind: PLAYER_COMMAND_KIND.PrioritizeLampWork,
    basis,
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-0",
        anchorCell: { x: 12, y: 7, cellIndex: 124 },
      },
      requestedAction: "auto",
      priorityBand: 1,
    },
  };
}

function buildCommand(
  commandId: string,
  basis: PlayableCommandBasis,
): {
  readonly commandId: string;
  readonly kind: typeof PLAYER_COMMAND_KIND.QueueSimpleBuild;
  readonly basis: PlayableCommandBasis;
  readonly payload: {
    readonly blueprint: { readonly kind: "simple_lamp_post"; readonly blueprintDefId: 4 };
    readonly anchorCell: { readonly x: 12; readonly y: 7; readonly cellIndex: 124 };
    readonly orientation: 0;
    readonly priorityBand: 1;
  };
} {
  return {
    commandId,
    kind: PLAYER_COMMAND_KIND.QueueSimpleBuild,
    basis,
    payload: {
      blueprint: { kind: "simple_lamp_post", blueprintDefId: 4 },
      anchorCell: { x: 12, y: 7, cellIndex: 124 },
      orientation: 0,
      priorityBand: 1,
    },
  };
}

function advanceCommand(tick: number): {
  readonly commandId: string;
  readonly kind: typeof PLAYER_COMMAND_KIND.Noop;
} {
  return {
    commandId: createPlayableAdvanceCommandId(tick),
    kind: PLAYER_COMMAND_KIND.Noop,
  };
}

function commandResult(messages: readonly SimulationToMainMessage[]): CommandResultMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult) {
      return message;
    }
  }
  throw new Error("expected CommandResult");
}

function uiDelta(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      return message;
    }
  }
  throw new Error("expected UiDelta");
}
