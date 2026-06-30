import { describe, expect, it } from "vitest";

import type {
  BrowserSimulationWorkerHandle,
  BrowserSimulationWorkerMessageEvent,
} from "@wuming-town/sim-worker";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type MainToSimulationMessage,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import {
  WEB_PLAYABLE_WORKER_SCENARIO_ID,
  advanceWebPlayableWorkerScenarioToTick,
  createWebSimulationWorkerSession,
  sendWebPlayableCommandBatch,
  startWebPlayableWorkerScenario,
  readWebPlayableProjection,
} from "./simulation-worker-session";

describe("web Simulation Worker session bridge adapter", () => {
  it("uses the sim-worker package-root session API for WM-0150 transport only", () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    startWebPlayableWorkerScenario(session, "5");
    sendWebPlayableCommandBatch(session, []);
    advanceWebPlayableWorkerScenarioToTick(session, 45);
    session.destroy();

    expect(worker.messages.slice(0, 2)).toStrictEqual([
      {
        protocolVersion: 1,
        schemaVersion: 2,
        sessionId: "web-session",
        sequence: 1,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
        payload: {
          seed: "5",
          catalogVersion: WEB_PLAYABLE_WORKER_SCENARIO_ID,
        },
      },
      {
        protocolVersion: 1,
        schemaVersion: 2,
        sessionId: "web-session",
        sequence: 2,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
        payload: {
          commands: [],
        },
      },
    ]);

    const advanceMessage = worker.messages[2];
    if (advanceMessage?.kind !== MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch) {
      throw new Error("expected public advance helper to post PlayerCommandBatch");
    }
    const advanceCommand = advanceMessage.payload.commands[0];
    if (advanceCommand === undefined) {
      throw new Error("expected public advance helper to post one command");
    }
    expect(typeof advanceCommand.commandId).toBe("string");
    expect(advanceCommand.kind).toBe(PLAYER_COMMAND_KIND.Noop);
  });

  it("reads public playable projections from UiDelta without summary parsing", () => {
    const projection = readWebPlayableProjection(playableUiDelta());

    expect(projection).toMatchObject({
      playableCommandReadModelVersion: 1,
      basis: {
        tick: 12,
        commandBasis: {
          basisTick: 12,
        },
      },
    });
    expect(readWebPlayableProjection(playableReady())).toBeUndefined();
  });
});

class RecordingBrowserWorker implements BrowserSimulationWorkerHandle {
  readonly messages: MainToSimulationMessage[] = [];
  terminated = false;

  postMessage(message: MainToSimulationMessage): void {
    this.messages.push(message);
  }

  addEventListener(
    type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    expect(type).toBe("message");
    expect(listener).toBeDefined();
  }

  removeEventListener(
    type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    expect(type).toBe("message");
    expect(listener).toBeDefined();
  }

  terminate(): void {
    this.terminated = true;
  }
}

function playableUiDelta(): SimulationToMainMessage {
  return {
    protocolVersion: 1,
    schemaVersion: 2,
    sessionId: "web-session",
    sequence: 4,
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
    payload: {
      tick: 12,
      summaries: [],
      readOnly: true,
      playable: {
        playableCommandReadModelVersion: 1,
        basis: {
          tick: 12,
          snapshotSequence: 1,
          worldHash: "0xworld",
          readModelHash: "0xread",
          contentManifestHash: "0x0150015a",
          targetVersion: 1,
          mapVersion: 1,
          reservationVersion: 1,
          jobVersion: 1,
          commandBasis: {
            playableCommandContractVersion: 1,
            basisTick: 12,
            basisSnapshotSequence: 1,
            basisReadModelHash: "0xread",
            contentManifestHash: "0x0150015a",
          },
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
  };
}

function playableReady(): SimulationToMainMessage {
  return {
    protocolVersion: 1,
    schemaVersion: 2,
    sessionId: "web-session",
    sequence: 3,
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
    payload: {
      acceptedProtocolVersion: 1,
      acceptedSchemaVersion: 2,
      status: "ready",
    },
  };
}
