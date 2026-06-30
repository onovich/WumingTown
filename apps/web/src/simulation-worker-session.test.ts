import { describe, expect, it } from "vitest";

import type {
  BrowserSimulationWorkerHandle,
  BrowserSimulationWorkerMessageEvent,
} from "@wuming-town/sim-worker";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  type MainToSimulationMessage,
} from "@wuming-town/sim-protocol";

import {
  WEB_PLAYABLE_WORKER_SCENARIO_ID,
  createWebSimulationWorkerSession,
  sendWebPlayableCommandBatch,
  startWebPlayableWorkerScenario,
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
    session.destroy();

    expect(worker.messages).toStrictEqual([
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
