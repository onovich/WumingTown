import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_CORE_SMOKE } from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  SIM_PROTOCOL_SMOKE,
  validateMainToSimulationMessage,
  type CommandResultMessage,
  type MainToSimulationMessage,
  type ProtocolRejection,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export const SIM_WORKER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-worker",
  "package",
);

export const SIM_WORKER_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  SIM_PROTOCOL_SMOKE.packageName,
];

export interface SimulationWorker {
  receive(input: unknown): readonly SimulationToMainMessage[];
}

export interface SimulationWorkerMessageEvent {
  readonly data: unknown;
}

export interface SimulationWorkerPort {
  postMessage(message: SimulationToMainMessage): void;
  addEventListener(type: "message", listener: (event: SimulationWorkerMessageEvent) => void): void;
  removeEventListener?(
    type: "message",
    listener: (event: SimulationWorkerMessageEvent) => void,
  ): void;
}

export interface SimulationWorkerConnection {
  disconnect(): void;
}

type WorkerLifecycle = "idle" | "ready" | "shutdown";

interface SimulationWorkerState {
  lifecycle: WorkerLifecycle;
  sessionId: string;
  lastMainSequence: number;
  nextWorkerSequence: number;
  tick: number;
  droppedSnapshots: number;
  queuedReliableMessages: number;
  speed: 0 | 1 | 2 | 3;
  paused: boolean;
}

export function createSimulationWorker(): SimulationWorker {
  const state: SimulationWorkerState = {
    lifecycle: "idle",
    sessionId: "",
    lastMainSequence: 0,
    nextWorkerSequence: 1,
    tick: 0,
    droppedSnapshots: 0,
    queuedReliableMessages: 0,
    speed: 1,
    paused: false,
  };

  return {
    receive(input: unknown): readonly SimulationToMainMessage[] {
      const validation = validateMainToSimulationMessage(input);

      if (!validation.ok) {
        return [
          makeRejectedCommandResult(
            state,
            validation.observedSessionId,
            validation.observedSequence,
            validation.reason,
          ),
        ];
      }

      const message = validation.message;
      const guard = guardLifecycleAndOrdering(state, message);

      if (guard !== undefined) {
        return [rejectValidMessage(state, message, guard)];
      }

      state.lastMainSequence = message.sequence;
      return handleAcceptedMessage(state, message);
    },
  };
}

export function connectSimulationWorkerPort(
  port: SimulationWorkerPort,
  worker: SimulationWorker = createSimulationWorker(),
): SimulationWorkerConnection {
  const listener = (event: SimulationWorkerMessageEvent): void => {
    const responses = worker.receive(event.data);

    for (const response of responses) {
      port.postMessage(response);
    }
  };

  port.addEventListener("message", listener);

  return {
    disconnect(): void {
      port.removeEventListener?.("message", listener);
    },
  };
}

function guardLifecycleAndOrdering(
  state: SimulationWorkerState,
  message: MainToSimulationMessage,
): ProtocolRejection | undefined {
  if (state.lifecycle !== "idle" && message.sessionId !== state.sessionId) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.StaleSession,
      detail: "message sessionId does not match the active simulation session",
    };
  }

  if (message.sequence <= state.lastMainSequence) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.StaleSequence,
      detail: "message sequence has already been processed by this Worker",
    };
  }

  if (state.lifecycle === "shutdown") {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: "simulation session is already shut down",
    };
  }

  if (state.lifecycle === "idle" && !isSessionStartMessage(message)) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: "simulation session must be initialized or loaded before commands are accepted",
    };
  }

  if (state.lifecycle === "ready" && isSessionStartMessage(message)) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: "simulation session is already active",
    };
  }

  return undefined;
}

function handleAcceptedMessage(
  state: SimulationWorkerState,
  message: MainToSimulationMessage,
): readonly SimulationToMainMessage[] {
  switch (message.kind) {
    case MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession:
      state.lifecycle = "ready";
      state.sessionId = message.sessionId;
      state.tick = 0;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession:
      state.lifecycle = "ready";
      state.sessionId = message.sessionId;
      state.tick = message.payload.checkpointSequence;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch:
      state.tick += message.payload.commands.length;
      return [
        makeAcceptedCommandResult(state, message.sequence),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed:
      state.speed = message.payload.speed;
      return [makeAcceptedCommandResult(state, message.sequence), makeMetricsSample(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Pause:
      state.paused = message.payload.paused;
      return [makeAcceptedCommandResult(state, message.sequence), makeMetricsSample(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail:
      return [makeAcceptedCommandResult(state, message.sequence), makeUiDelta(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave:
      return [
        makeAcceptedCommandResult(state, message.sequence),
        makeSaveReady(state, message.sequence),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand:
      return [
        makeAcceptedCommandResult(state, message.sequence),
        makeAlertBatch(state, {
          code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
          detail: `dev echo: ${message.payload.text}`,
        }),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown:
      state.lifecycle = "shutdown";
      return [makeAcceptedCommandResult(state, message.sequence)];
  }
}

function rejectValidMessage(
  state: SimulationWorkerState,
  message: MainToSimulationMessage,
  reason: ProtocolRejection,
): CommandResultMessage {
  state.lastMainSequence = Math.max(state.lastMainSequence, message.sequence);
  return makeRejectedCommandResult(state, message.sessionId, message.sequence, reason);
}

function makeReady(state: SimulationWorkerState): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
    payload: {
      acceptedProtocolVersion: SIM_PROTOCOL_VERSION,
      acceptedSchemaVersion: SIM_SCHEMA_VERSION,
      status: "ready",
    },
  };
}

function makeRenderSnapshot(
  state: SimulationWorkerState,
  sourceSequence: number,
): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
    payload: {
      snapshotSequence: sourceSequence,
      tick: state.tick,
      entityCount: 0,
    },
  };
}

function makeUiDelta(state: SimulationWorkerState): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
    payload: {
      tick: state.tick,
      summaries: [
        `lifecycle=${state.lifecycle}; speed=${String(state.speed)}; paused=${String(state.paused)}`,
      ],
    },
  };
}

function makeAcceptedCommandResult(
  state: SimulationWorkerState,
  inReplyToSequence: number,
): CommandResultMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
    payload: {
      inReplyToSequence,
      accepted: true,
    },
  };
}

function makeRejectedCommandResult(
  state: SimulationWorkerState,
  observedSessionId: string,
  inReplyToSequence: number,
  reason: ProtocolRejection,
): CommandResultMessage {
  return {
    ...nextEnvelopeBase(state, observedSessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
    payload: {
      inReplyToSequence,
      accepted: false,
      reason,
    },
  };
}

function makeAlertBatch(
  state: SimulationWorkerState,
  reason: ProtocolRejection,
): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch,
    payload: {
      alerts: [reason],
    },
  };
}

function makeSaveReady(
  state: SimulationWorkerState,
  sourceSequence: number,
): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
    payload: {
      saveId: `${state.sessionId}:${String(sourceSequence)}`,
      sourceSequence,
    },
  };
}

function makeMetricsSample(state: SimulationWorkerState): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
    payload: {
      tick: state.tick,
      droppedSnapshots: state.droppedSnapshots,
      queuedReliableMessages: state.queuedReliableMessages,
    },
  };
}

interface OutgoingEnvelopeBase {
  readonly protocolVersion: typeof SIM_PROTOCOL_VERSION;
  readonly schemaVersion: typeof SIM_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly sequence: number;
}

function nextEnvelopeBase(
  state: SimulationWorkerState,
  observedSessionId: string,
): OutgoingEnvelopeBase {
  const sessionId = observedSessionId.length > 0 ? observedSessionId : "invalid-session";
  const sequence = state.nextWorkerSequence;
  state.nextWorkerSequence += 1;

  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId,
    sequence,
  };
}

function isSessionStartMessage(message: MainToSimulationMessage): boolean {
  return (
    message.kind === MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession ||
    message.kind === MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession
  );
}
