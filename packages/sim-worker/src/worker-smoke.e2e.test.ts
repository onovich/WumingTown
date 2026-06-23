import { describe, expect, it } from "vitest";

import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type CommandResultMessage,
  type MainToSimulationMessage,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import {
  connectSimulationWorkerPort,
  createSimulationWorker,
  type SimulationWorkerMessageEvent,
  type SimulationWorkerPort,
} from "./index";

describe("worker-smoke simulation Worker protocol", () => {
  it("round-trips through the Node harness without exposing mutable simulation state", () => {
    const worker = createSimulationWorker();

    const initResponses = worker.receive(makeInitSession(1));
    expect(kinds(initResponses)).toStrictEqual([
      SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
      SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
      SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
    ]);

    const commandResponses = worker.receive(makeNoopBatch(2));
    expect(commandResult(commandResponses).payload).toMatchObject({
      inReplyToSequence: 2,
      accepted: true,
    });
    expect(kinds(commandResponses)).toContain(SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot);
  });

  it("rejects stale sequences with structured reason codes", () => {
    const worker = createSimulationWorker();

    worker.receive(makeInitSession(1));
    const staleResult = commandResult(worker.receive(makePause(1)));

    expect(staleResult.payload.accepted).toBe(false);
    expect(staleResult.payload.reason).toStrictEqual({
      code: SIMULATION_PROTOCOL_REASON_CODE.StaleSequence,
      detail: "message sequence has already been processed by this Worker",
    });
  });

  it("rejects stale sessions with structured reason codes", () => {
    const worker = createSimulationWorker();

    worker.receive(makeInitSession(1));
    const staleResult = commandResult(
      worker.receive({
        ...makePause(2),
        sessionId: "other-session",
      }),
    );

    expect(staleResult.payload.accepted).toBe(false);
    expect(staleResult.payload.reason?.code).toBe(SIMULATION_PROTOCOL_REASON_CODE.StaleSession);
  });

  it("rejects lifecycle errors before initialization", () => {
    const worker = createSimulationWorker();
    const rejected = commandResult(worker.receive(makePause(1)));

    expect(rejected.payload.accepted).toBe(false);
    expect(rejected.payload.reason?.code).toBe(SIMULATION_PROTOCOL_REASON_CODE.LifecycleError);
  });

  it("round-trips through a browser Worker-compatible message port", () => {
    const port = new MemoryWorkerPort();
    const connection = connectSimulationWorkerPort(port);

    port.dispatch(makeInitSession(1));
    port.dispatch(makeNoopBatch(2));
    connection.disconnect();

    expect(kinds(port.messages)).toContain(SIMULATION_TO_MAIN_MESSAGE_KIND.Ready);
    expect(kinds(port.messages)).toContain(SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult);
    expect(commandResult(port.messages).payload.accepted).toBe(true);
  });
});

class MemoryWorkerPort implements SimulationWorkerPort {
  readonly messages: SimulationToMainMessage[] = [];
  private listener: ((event: SimulationWorkerMessageEvent) => void) | undefined;

  postMessage(message: SimulationToMainMessage): void {
    this.messages.push(message);
  }

  addEventListener(type: "message", listener: (event: SimulationWorkerMessageEvent) => void): void {
    expect(type).toBe("message");
    this.listener = listener;
  }

  removeEventListener(
    type: "message",
    listener: (event: SimulationWorkerMessageEvent) => void,
  ): void {
    expect(type).toBe("message");
    if (this.listener === listener) {
      this.listener = undefined;
    }
  }

  dispatch(data: unknown): void {
    const activeListener = this.listener;
    if (activeListener === undefined) {
      throw new Error("no message listener registered");
    }

    activeListener({ data });
  }
}

function makeInitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "seed-0005",
      catalogVersion: "catalog-0001",
    },
  };
}

function makeNoopBatch(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: `command-${String(sequence)}`,
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makePause(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Pause,
    payload: {
      paused: true,
    },
  };
}

function kinds(messages: readonly SimulationToMainMessage[]): readonly string[] {
  return messages.map((message) => message.kind);
}

function commandResult(messages: readonly SimulationToMainMessage[]): CommandResultMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult) {
      return message;
    }
  }

  throw new Error("expected CommandResult message");
}
