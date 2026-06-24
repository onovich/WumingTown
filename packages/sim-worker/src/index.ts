import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import {
  HAULING_BUILDING_SCENARIO_ID,
  SIM_CORE_SMOKE,
  createM1AdvanceCommandId,
  createM1HaulingBuildingSaveEnvelope,
  createM1ReadOnlyProjection,
  parseM1AdvanceCommandId,
  runHaulingBuildingScenario,
  type M1ReadOnlyProjection,
} from "@wuming-town/sim-core";
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
  m1Scenario: M1WorkerScenarioState | undefined;
}

interface M1WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
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
    m1Scenario: undefined,
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
      state.m1Scenario =
        message.payload.catalogVersion === HAULING_BUILDING_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
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
      state.m1Scenario = undefined;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch:
      if (state.m1Scenario === undefined) {
        state.tick += message.payload.commands.length;
      } else {
        applyM1Commands(state, message.payload.commands);
      }
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
  const projection = readM1Projection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
      payload: {
        snapshotSequence: sourceSequence,
        tick: state.tick,
        entityCount: projection.renderSnapshot.entityCount,
        scenarioId: projection.scenarioId,
        worldHash: projection.worldHash,
        readModelHash: projection.readModelHash,
        readOnly: true,
      },
    };
  }

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
  const projection = readM1Projection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      payload: {
        tick: state.tick,
        summaries: projection.uiDetail.summaries,
        scenarioId: projection.scenarioId,
        readModelHash: projection.readModelHash,
        detailHash: projection.uiDetail.detailHash,
        readOnly: true,
      },
    };
  }

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
  const saved =
    state.m1Scenario === undefined
      ? undefined
      : createM1HaulingBuildingSaveEnvelope(state.m1Scenario.seed, state.tick);

  if (saved?.ok === true) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
      payload: {
        saveId: `${state.sessionId}:${String(sourceSequence)}`,
        sourceSequence,
        scenarioId: saved.save.scenarioId,
        checkpointTick: saved.save.createdTick,
        worldHash: saved.save.sections.commandLogTail.checkpointWorldHash,
      },
    };
  }

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
  const projection = readM1Projection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
      payload: {
        tick: state.tick,
        droppedSnapshots: state.droppedSnapshots,
        queuedReliableMessages: state.queuedReliableMessages,
        scenarioId: projection.scenarioId,
        worldHash: projection.worldHash,
        checkpointCount: state.m1Scenario?.checkpointCount ?? 0,
      },
    };
  }

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

function applyM1Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const tick = parseM1AdvanceCommandId(command.commandId);
    if (tick !== undefined && tick >= state.tick) {
      state.tick = tick;
      if (state.m1Scenario !== undefined) {
        state.m1Scenario.checkpointCount += 1;
      }
    }
  }
}

function readM1Projection(state: SimulationWorkerState): M1ReadOnlyProjection | undefined {
  const scenario = state.m1Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runHaulingBuildingScenario({ seed: scenario.seed, ticks: state.tick });
  return createM1ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

export function createM1WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (const tick of checkpointTicks) {
    commandIds.push(createM1AdvanceCommandId(tick));
  }

  return commandIds;
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
