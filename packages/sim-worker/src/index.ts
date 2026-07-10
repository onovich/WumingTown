import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import {
  HAULING_BUILDING_SCENARIO_ID,
  M2_WORK_LOGISTICS_SCENARIO_ID,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  M5_WORKER_ALPHA_CONTENT_SCENARIO_ID,
  PLAYABLE_COMMAND_SLICE_ALIAS,
  PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
  createM4AdvanceCommandId,
  SIM_CORE_SMOKE,
  createM1AdvanceCommandId,
  createM1HaulingBuildingSaveEnvelope,
  createM1ReadOnlyProjection,
  createM2AdvanceCommandId,
  createM2ReadOnlyProjection,
  createM2WorkLogisticsSaveEnvelope,
  createM3AdvanceCommandId,
  createM3OrdinaryLifeSaveEnvelope,
  createM3ReadOnlyProjection,
  createM4CoreVerticalSliceSaveEnvelope,
  createM4ReadOnlyProjection,
  createM5WorkerAdvanceCommandId,
  createM5WorkerFocusedSaveEnvelope,
  createM5WorkerProjection,
  createPlayableCommandSliceRuntime,
  parseM1AdvanceCommandId,
  parseM2AdvanceCommandId,
  parseM3AdvanceCommandId,
  parseM4AdvanceCommandId,
  parseM5WorkerAdvanceCommandId,
  parsePlayableAdvanceCommandId,
  runM4CoreVerticalSliceScenario,
  runM3OrdinaryLifeScenario,
  runM2WorkLogisticsScenario,
  runHaulingBuildingScenario,
  type M1ReadOnlyProjection,
  type M2ReadOnlyProjection,
  type M3ReadOnlyProjection,
  type M4ReadOnlyProjection,
  type M5WorkerProjection,
  type PlayableCommandResult,
  type PlayableCommandSliceRuntime,
  type PlayableReadModel,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  SIM_PROTOCOL_SMOKE,
  validateMainToSimulationMessage,
  type CommandResultMessage,
  type MainToSimulationMessage,
  type PlayableProjectionV1,
  type PlayerCommand,
  type ProtocolRejection,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import { createPlayableProjection } from "./playable-projection";
import { createGameSessionContinuousScheduler } from "./game-session-scheduler";
import { GameSessionWorkerHost } from "./game-session-worker-host";
import { GameSessionWorkerOutbox } from "./game-session-worker-outbox";

export {
  PR1_GAME_SESSION_DEFAULT_SEED,
  PR1_GAME_SESSION_SCENARIO_ID,
  WM0150_PLAYABLE_COMMAND_DEFAULT_SEED,
  WM0150_PLAYABLE_COMMAND_SCENARIO_ID,
  advancePlayableCommandScenarioToTick,
  createBrowserSimulationWorker,
  createBrowserSimulationWorkerSession,
  drainPlayableCommandsToTerminal,
  waitForPlayableProjectionAtOrBeyondTick,
  type BrowserSimulationWorkerFactory,
  type BrowserSimulationWorkerHandle,
  type BrowserSimulationWorkerLifecycleEvent,
  type BrowserSimulationWorkerLifecycleListener,
  type BrowserSimulationWorkerMessageEvent,
  type BrowserSimulationWorkerMessageListener,
  type BrowserSimulationWorkerSession,
  type BrowserSimulationWorkerSessionOptions,
  type BrowserSimulationWorkerSessionState,
  type InitPlayableCommandScenarioInput,
  type InitGameSessionInput,
  type ReliableSimulationWorkerMessage,
  type ReliableSimulationWorkerMessageListener,
} from "./browser-session";
export type {
  PlayableDrainOrderState,
  PlayableDrainRequest,
  PlayableDrainResult,
  PlayableDrainStatus,
  PlayableProjectionWaitRequest,
  PlayableProjectionWaitResult,
  PlayableProjectionWaitStatus,
} from "./playable-drain";

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
  runScheduledQuantum(): readonly SimulationToMainMessage[];
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

type WorkerLifecycle = "idle" | "ready" | "shutdown" | "fatal";

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
  m2Scenario: M2WorkerScenarioState | undefined;
  m3Scenario: M3WorkerScenarioState | undefined;
  m4Scenario: M4WorkerScenarioState | undefined;
  m5Scenario: M5WorkerScenarioState | undefined;
  playableScenario: PlayableWorkerScenarioState | undefined;
  gameSession: GameSessionWorkerHost | undefined;
}

interface M1WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M2WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M3WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M4WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M5WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface PlayableWorkerScenarioState {
  readonly seed: string;
  readonly runtime: PlayableCommandSliceRuntime;
  checkpointCount: number;
  latestCommandResults: readonly PlayableCommandResult[];
}

export type M5WorkerProjectionBasisValidation =
  | {
      readonly ok: true;
      readonly contentManifestHash: string;
      readonly projectionHash: string;
      readonly worldHash: string;
    }
  | {
      readonly ok: false;
      readonly expectedContentManifestHash: string;
      readonly observedContentManifestHash: string;
      readonly projectionHash: string;
      readonly reason: ProtocolRejection;
    };

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
    m2Scenario: undefined,
    m3Scenario: undefined,
    m4Scenario: undefined,
    m5Scenario: undefined,
    playableScenario: undefined,
    gameSession: undefined,
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
    runScheduledQuantum(): readonly SimulationToMainMessage[] {
      return runScheduledGameSessionQuantum(state);
    },
  };
}

export function connectSimulationWorkerPort(
  port: SimulationWorkerPort,
  worker: SimulationWorker = createSimulationWorker(),
): SimulationWorkerConnection {
  const outbox = new GameSessionWorkerOutbox();
  let disconnected = false;
  const flush = (): void => {
    const messages = outbox.drain();
    for (const message of messages) port.postMessage(message);
  };
  const listener = (event: SimulationWorkerMessageEvent): void => {
    const responses = worker.receive(event.data);
    outbox.enqueue(responses);
    if (didAcceptShutdown(event.data, responses)) scheduler.stop();
    flush();
  };

  const scheduler = createGameSessionContinuousScheduler((quantumCount): void => {
    for (let quantum = 0; quantum < quantumCount; quantum += 1) {
      outbox.enqueue(worker.runScheduledQuantum());
    }
    flush();
  });

  port.addEventListener("message", listener);
  scheduler.start();

  return {
    disconnect(): void {
      if (disconnected) return;
      disconnected = true;
      scheduler.stop();
      port.removeEventListener?.("message", listener);
    },
  };
}

function didAcceptShutdown(input: unknown, responses: readonly SimulationToMainMessage[]): boolean {
  const validation = validateMainToSimulationMessage(input);
  if (!validation.ok || validation.message.kind !== MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown) {
    return false;
  }
  for (const response of responses) {
    if (
      response.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult &&
      response.payload.accepted &&
      response.payload.inReplyToSequence === validation.message.sequence
    ) {
      return true;
    }
  }
  return false;
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

  if (state.lifecycle === "shutdown" || state.lifecycle === "fatal") {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: `simulation session cannot accept messages while ${state.lifecycle}`,
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
    case MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession: {
      const gameSessionMessages = initializeGameSessionMode(state, message);
      if (gameSessionMessages !== undefined) return gameSessionMessages;
      state.lifecycle = "ready";
      state.sessionId = message.sessionId;
      state.tick = 0;
      state.m1Scenario =
        message.payload.catalogVersion === HAULING_BUILDING_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m2Scenario =
        message.payload.catalogVersion === M2_WORK_LOGISTICS_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m3Scenario =
        message.payload.catalogVersion === M3_ORDINARY_LIFE_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m4Scenario =
        message.payload.catalogVersion === M4_CORE_VERTICAL_SLICE_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m5Scenario =
        message.payload.catalogVersion === M5_WORKER_ALPHA_CONTENT_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.playableScenario =
        message.payload.catalogVersion === PLAYABLE_COMMAND_SLICE_SCENARIO_ID ||
        message.payload.catalogVersion === PLAYABLE_COMMAND_SLICE_ALIAS
          ? {
              seed: message.payload.seed,
              runtime: createPlayableCommandSliceRuntime(),
              checkpointCount: 1,
              latestCommandResults: [],
            }
          : undefined;
      state.gameSession = undefined;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];
    }

    case MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession:
      if (message.payload.saveId.startsWith("game-session:")) {
        state.lifecycle = "fatal";
        state.sessionId = message.sessionId;
        return [
          makeFatalSimulationError(state, {
            code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
            detail: "GameSession focused load snapshots are not implemented",
          }),
        ];
      }
      state.lifecycle = "ready";
      state.sessionId = message.sessionId;
      state.tick = message.payload.checkpointSequence;
      state.m1Scenario = undefined;
      state.m2Scenario = undefined;
      state.m3Scenario = undefined;
      state.m4Scenario = undefined;
      state.m5Scenario = undefined;
      state.playableScenario = undefined;
      state.gameSession = undefined;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch:
      if (state.gameSession !== undefined) {
        const queued = state.gameSession.queueCommands(message.payload.commands);
        if (!queued.ok)
          return [
            makeRejectedCommandResult(state, state.sessionId, message.sequence, queued.reason),
          ];
        state.tick = state.gameSession.tick;
        return [
          makeAcceptedCommandResult(state, message.sequence),
          ...makeGameSessionProjectionMessages(state),
        ];
      } else if (state.m1Scenario !== undefined) {
        applyM1Commands(state, message.payload.commands);
      } else if (state.m2Scenario !== undefined) {
        applyM2Commands(state, message.payload.commands);
      } else if (state.m3Scenario !== undefined) {
        applyM3Commands(state, message.payload.commands);
      } else if (state.m4Scenario !== undefined) {
        applyM4Commands(state, message.payload.commands);
      } else if (state.m5Scenario !== undefined) {
        applyM5Commands(state, message.payload.commands);
      } else if (state.playableScenario !== undefined) {
        applyPlayableCommands(state, message.payload.commands);
      } else {
        state.tick += message.payload.commands.length;
      }
      return [
        makeAcceptedCommandResult(
          state,
          message.sequence,
          state.playableScenario?.latestCommandResults,
        ),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed:
      state.speed = message.payload.speed;
      if (state.gameSession !== undefined) {
        state.gameSession.setSpeed(message.payload.speed);
        return [
          makeAcceptedCommandResult(state, message.sequence),
          ...makeGameSessionProjectionMessages(state),
        ];
      }
      return [makeAcceptedCommandResult(state, message.sequence), makeMetricsSample(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Pause:
      state.paused = message.payload.paused;
      if (state.gameSession !== undefined) {
        state.gameSession.setPaused(message.payload.paused);
        return [
          makeAcceptedCommandResult(state, message.sequence),
          ...makeGameSessionProjectionMessages(state),
        ];
      }
      return [makeAcceptedCommandResult(state, message.sequence), makeMetricsSample(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail:
      if (state.gameSession !== undefined) {
        state.gameSession.setSelection(message.payload.subject);
        return [
          makeAcceptedCommandResult(state, message.sequence),
          ...makeGameSessionProjectionMessages(state),
        ];
      }
      return [makeAcceptedCommandResult(state, message.sequence), makeUiDelta(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave:
      if (state.gameSession !== undefined) {
        return [
          makeRejectedCommandResult(state, state.sessionId, message.sequence, {
            code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
            detail: "GameSession focused save snapshots are not implemented",
          }),
        ];
      }
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

function initializeGameSessionMode(
  state: SimulationWorkerState,
  message: Extract<
    MainToSimulationMessage,
    { readonly kind: typeof MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession }
  >,
): readonly SimulationToMainMessage[] | undefined {
  const request = message.payload.projectionRequest;
  const isGameSessionCatalog = GameSessionWorkerHost.isCatalogVersion(
    message.payload.catalogVersion,
  );
  if (request === undefined && !isGameSessionCatalog) return undefined;

  state.sessionId = message.sessionId;
  if (request === undefined || !isGameSessionCatalog) {
    state.lifecycle = "fatal";
    return [
      makeFatalSimulationError(state, {
        code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
        detail:
          request === undefined
            ? "PR-1 GameSession catalog requires projection request version 1"
            : "GameSession projection request requires the PR-1 GameSession catalog",
      }),
    ];
  }

  const initialized = GameSessionWorkerHost.initialize(message.payload.seed);
  if (!initialized.ok) {
    state.lifecycle = "fatal";
    return [makeFatalSimulationError(state, initialized.reason)];
  }

  state.lifecycle = "ready";
  state.tick = initialized.host.tick;
  state.speed = 1;
  state.paused = false;
  state.m1Scenario = undefined;
  state.m2Scenario = undefined;
  state.m3Scenario = undefined;
  state.m4Scenario = undefined;
  state.m5Scenario = undefined;
  state.playableScenario = undefined;
  state.gameSession = initialized.host;
  return [makeReady(state), ...makeGameSessionProjectionMessages(state)];
}

function runScheduledGameSessionQuantum(
  state: SimulationWorkerState,
): readonly SimulationToMainMessage[] {
  if (state.lifecycle !== "ready" || state.gameSession === undefined) return [];
  const advanced = state.gameSession.advanceScheduledQuantum();
  if (advanced === 0) return [];
  state.tick = state.gameSession.tick;
  return makeGameSessionProjectionMessages(state);
}

function makeGameSessionProjectionMessages(
  state: SimulationWorkerState,
): readonly SimulationToMainMessage[] {
  const host = state.gameSession;
  if (host === undefined) return [];
  const publication = host.createPublication();
  const messages: SimulationToMainMessage[] = [
    {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
      payload: {
        snapshotSequence: publication.render.basis.snapshotSequence,
        tick: publication.render.basis.tick,
        entityCount: publication.render.entities.length,
        scenarioId: publication.render.basis.scenarioId,
        worldHash: publication.render.basis.worldHash,
        readModelHash: publication.render.basis.readModelHash,
        readOnly: true,
        gameSession: publication.render,
      },
    },
    {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      payload: {
        tick: publication.ui.basis.tick,
        summaries: [],
        scenarioId: publication.ui.basis.scenarioId,
        readModelHash: publication.ui.basis.readModelHash,
        readOnly: true,
        gameSession: publication.ui,
      },
    },
  ];
  if (publication.changedAlerts.length > 0) {
    messages.push({
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch,
      payload: { alerts: [], gameSession: publication.changedAlerts },
    });
  }
  messages.push({
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
    payload: {
      tick: publication.ui.basis.tick,
      droppedSnapshots: state.droppedSnapshots,
      queuedReliableMessages: state.queuedReliableMessages,
      scenarioId: publication.ui.basis.scenarioId,
      worldHash: publication.ui.basis.worldHash,
      checkpointCount: publication.ui.basis.snapshotSequence,
    },
  });
  return messages;
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
      ...(state.gameSession === undefined
        ? {}
        : { projectionContract: state.gameSession.projectionContract }),
    },
  };
}

function makeFatalSimulationError(
  state: SimulationWorkerState,
  reason: ProtocolRejection,
): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
    payload: { reason },
  };
}

function makeRenderSnapshot(
  state: SimulationWorkerState,
  sourceSequence: number,
): SimulationToMainMessage {
  const projection = readWorkerProjection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
      payload: {
        snapshotSequence: sourceSequence,
        tick: state.tick,
        entityCount: projection.entityCount,
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
  const projection = readWorkerProjection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      payload: {
        tick: state.tick,
        summaries: projection.summaries,
        scenarioId: projection.scenarioId,
        readModelHash: projection.readModelHash,
        detailHash: projection.detailHash,
        readOnly: true,
        ...(projection.playable !== undefined ? { playable: projection.playable } : {}),
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
  commandResults?: readonly PlayableCommandResult[],
): CommandResultMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
    payload: {
      inReplyToSequence,
      accepted: true,
      batchAccepted: true,
      commandResults: commandResults ?? [],
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
      batchAccepted: false,
      batchReason: reason,
      commandResults: [],
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
  const saved = createFocusedSave(state);
  const saveEnvelope = readFocusedSaveEnvelope(saved);

  if (saveEnvelope !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
      payload: {
        saveId: `${state.sessionId}:${String(sourceSequence)}`,
        sourceSequence,
        scenarioId: saveEnvelope.scenarioId,
        checkpointTick: saveEnvelope.createdTick,
        worldHash: saveEnvelope.worldHash,
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
  const projection = readWorkerProjection(state);

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
        checkpointCount: projection.checkpointCount,
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

function applyM2Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const tick = parseM2AdvanceCommandId(command.commandId);
    if (tick !== undefined && tick >= state.tick) {
      state.tick = tick;
      if (state.m2Scenario !== undefined) {
        state.m2Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyM3Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const tick = parseM3AdvanceCommandId(command.commandId);
    if (tick !== undefined && tick >= state.tick) {
      state.tick = tick;
      if (state.m3Scenario !== undefined) {
        state.m3Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyM4Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const parsed = parseM4AdvanceCommandId(command.commandId);
    if (parsed.ok && parsed.tick >= state.tick) {
      state.tick = parsed.tick;
      if (state.m4Scenario !== undefined) {
        state.m4Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyM5Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const parsed = parseM5WorkerAdvanceCommandId(command.commandId);
    if (parsed.ok && parsed.tick >= state.tick) {
      state.tick = parsed.tick;
      if (state.m5Scenario !== undefined) {
        state.m5Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyPlayableCommands(
  state: SimulationWorkerState,
  commands: readonly PlayerCommand[],
): void {
  const scenario = state.playableScenario;
  if (scenario === undefined) {
    return;
  }

  const results: PlayableCommandResult[] = [];
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (command === undefined) {
      continue;
    }

    if (command.kind === PLAYER_COMMAND_KIND.Noop) {
      const tick = parsePlayableAdvanceCommandId(command.commandId);
      if (tick !== undefined && tick >= scenario.runtime.currentTick) {
        scenario.runtime.advanceTo(tick);
        scenario.checkpointCount += 1;
      }
      continue;
    }

    if (
      command.kind === PLAYER_COMMAND_KIND.PrioritizeLampWork ||
      command.kind === PLAYER_COMMAND_KIND.QueueSimpleBuild
    ) {
      results.push(scenario.runtime.applyCommand(command, index));
    }
  }

  state.tick = scenario.runtime.currentTick;
  scenario.latestCommandResults = results;
}

interface WorkerProjectionView {
  readonly scenarioId: string;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly entityCount: number;
  readonly summaries: readonly string[];
  readonly detailHash: string;
  readonly checkpointCount: number;
  readonly playable?: PlayableProjectionV1;
}

function readWorkerProjection(state: SimulationWorkerState): WorkerProjectionView | undefined {
  const m1Projection = readM1Projection(state);
  if (m1Projection !== undefined) {
    return {
      scenarioId: m1Projection.scenarioId,
      worldHash: m1Projection.worldHash,
      readModelHash: m1Projection.readModelHash,
      entityCount: m1Projection.renderSnapshot.entityCount,
      summaries: m1Projection.uiDetail.summaries,
      detailHash: m1Projection.uiDetail.detailHash,
      checkpointCount: state.m1Scenario?.checkpointCount ?? 0,
    };
  }

  const m2Projection = readM2Projection(state);
  if (m2Projection !== undefined) {
    return {
      scenarioId: m2Projection.scenarioId,
      worldHash: m2Projection.worldHash,
      readModelHash: m2Projection.readModelHash,
      entityCount: m2Projection.renderSnapshot.actorCount,
      summaries: m2Projection.orderReadModel.summaries,
      detailHash: m2Projection.orderReadModel.detailHash,
      checkpointCount: state.m2Scenario?.checkpointCount ?? 0,
    };
  }

  const m3Projection = readM3Projection(state);
  if (m3Projection !== undefined) {
    return {
      scenarioId: m3Projection.scenarioId,
      worldHash: m3Projection.worldHash,
      readModelHash: m3Projection.readModelHash,
      entityCount: m3Projection.renderSnapshot.actorCount,
      summaries: m3Projection.scenarioReadModel.summaries,
      detailHash: m3Projection.scenarioReadModel.detailHash,
      checkpointCount: state.m3Scenario?.checkpointCount ?? 0,
    };
  }

  const m4Projection = readM4Projection(state);
  if (m4Projection !== undefined) {
    return {
      scenarioId: m4Projection.scenarioId,
      worldHash: m4Projection.worldHash,
      readModelHash: m4Projection.readModelHash,
      entityCount: m4Projection.renderSnapshot.branchCount,
      summaries: createM4WorkerSummaries(m4Projection),
      detailHash: m4Projection.scenarioReadModel.detailHash,
      checkpointCount: state.m4Scenario?.checkpointCount ?? 0,
    };
  }

  const m5Projection = readM5Projection(state);
  if (m5Projection !== undefined) {
    return {
      scenarioId: m5Projection.scenarioId,
      worldHash: m5Projection.worldHash,
      readModelHash: m5Projection.authoritativeReadModelHash,
      entityCount: m5Projection.entityCount,
      summaries: createM5WorkerSummaries(m5Projection),
      detailHash: m5Projection.detailHash,
      checkpointCount: state.m5Scenario?.checkpointCount ?? 0,
    };
  }

  const playableProjection = readPlayableProjection(state);
  if (playableProjection === undefined) {
    return undefined;
  }

  return {
    scenarioId: PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
    worldHash: playableProjection.basisWorldHash,
    readModelHash: playableProjection.basisReadModelHash,
    entityCount: playableProjection.pawns.length,
    summaries: playableProjection.summaries,
    detailHash: playableProjection.basisReadModelHash,
    checkpointCount: state.playableScenario?.checkpointCount ?? 0,
    playable: createPlayableProjection(playableProjection),
  };
}

function readM1Projection(state: SimulationWorkerState): M1ReadOnlyProjection | undefined {
  const scenario = state.m1Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runHaulingBuildingScenario({ seed: scenario.seed, ticks: state.tick });
  return createM1ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM2Projection(state: SimulationWorkerState): M2ReadOnlyProjection | undefined {
  const scenario = state.m2Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runM2WorkLogisticsScenario({ seed: scenario.seed, ticks: state.tick });
  return createM2ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM3Projection(state: SimulationWorkerState): M3ReadOnlyProjection | undefined {
  const scenario = state.m3Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runM3OrdinaryLifeScenario({ seed: scenario.seed, ticks: state.tick });
  return createM3ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM4Projection(state: SimulationWorkerState): M4ReadOnlyProjection | undefined {
  const scenario = state.m4Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runM4CoreVerticalSliceScenario({ seed: scenario.seed, ticks: state.tick });
  return createM4ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM5Projection(state: SimulationWorkerState): M5WorkerProjection | undefined {
  const scenario = state.m5Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  return createM5WorkerProjection(scenario.seed, state.tick);
}

function readPlayableProjection(state: SimulationWorkerState): PlayableReadModel | undefined {
  return state.playableScenario?.runtime.readModel();
}

function createM4WorkerSummaries(projection: M4ReadOnlyProjection): readonly string[] {
  const summaries: string[] = [];

  for (const summary of projection.scenarioReadModel.summaries) {
    summaries.push(summary);
  }

  for (const surface of projection.rebuiltIndexes.surfaces) {
    summaries.push(
      `m4-basis:${surface.name}=${surface.hash};version=${String(surface.sourceVersion)}`,
    );
  }

  summaries.push(`m4-basis:projection=${projection.readModelHash};tick=${String(projection.tick)}`);
  return summaries;
}

function createM5WorkerSummaries(projection: M5WorkerProjection): readonly string[] {
  const summaries: string[] = [];

  for (const summary of projection.summaries) {
    summaries.push(summary);
  }

  summaries.push(`m5-basis:content=${projection.contentManifestHash}`);
  summaries.push(
    `m5-basis:review=third-knock:${projection.thirdKnockReviewReason};old-bridge:${projection.oldBridgeReviewReason}`,
  );
  summaries.push(`m5-basis:season-events=count:${String(projection.seasonSelectionCount)}`);

  for (const surface of projection.rebuiltSurfaces) {
    summaries.push(
      `m5-basis:${surface.name}=${surface.hash};version=${String(surface.sourceVersion)}`,
    );
  }

  summaries.push(`m5-basis:read-model=${projection.authoritativeReadModelHash}`);
  summaries.push(
    `m5-basis:projection=${projection.projectionHash};tick=${String(projection.tick)}`,
  );
  return summaries;
}

export interface M5WorkerProjectionBasisView {
  readonly contentManifestHash: string;
  readonly projectionHash?: string;
  readonly readModelHash?: string;
  readonly worldHash: string;
  readonly scenarioReadModel: {
    readonly contentManifestHash: string;
  };
}

export function validateM5WorkerProjectionBasis(
  projection: M5WorkerProjectionBasisView,
  expectedContentManifestHash: string,
): M5WorkerProjectionBasisValidation {
  const observedContentManifestHash =
    projection.contentManifestHash === projection.scenarioReadModel.contentManifestHash
      ? projection.contentManifestHash
      : `${projection.contentManifestHash}/${projection.scenarioReadModel.contentManifestHash}`;

  if (
    projection.contentManifestHash !== expectedContentManifestHash ||
    projection.scenarioReadModel.contentManifestHash !== expectedContentManifestHash
  ) {
    return {
      ok: false,
      expectedContentManifestHash,
      observedContentManifestHash,
      projectionHash: readProjectionHash(projection),
      reason: {
        code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
        detail:
          "stale M5 projection basis: content manifest hash does not match active Worker content basis",
      },
    };
  }

  return {
    ok: true,
    contentManifestHash: projection.contentManifestHash,
    projectionHash: readProjectionHash(projection),
    worldHash: projection.worldHash,
  };
}

function readProjectionHash(projection: M5WorkerProjectionBasisView): string {
  return projection.projectionHash ?? projection.readModelHash ?? "0x00000000";
}

function createFocusedSave(
  state: SimulationWorkerState,
):
  | ReturnType<typeof createM1HaulingBuildingSaveEnvelope>
  | ReturnType<typeof createM2WorkLogisticsSaveEnvelope>
  | ReturnType<typeof createM3OrdinaryLifeSaveEnvelope>
  | ReturnType<typeof createM4CoreVerticalSliceSaveEnvelope>
  | ReturnType<typeof createM5WorkerFocusedSaveEnvelope>
  | undefined {
  if (state.m1Scenario !== undefined) {
    return createM1HaulingBuildingSaveEnvelope(state.m1Scenario.seed, state.tick);
  }

  if (state.m2Scenario !== undefined) {
    return createM2WorkLogisticsSaveEnvelope(state.m2Scenario.seed, state.tick);
  }

  if (state.m3Scenario !== undefined) {
    return createM3OrdinaryLifeSaveEnvelope(state.m3Scenario.seed, state.tick);
  }

  if (state.m4Scenario !== undefined) {
    return createM4CoreVerticalSliceSaveEnvelope(state.m4Scenario.seed, state.tick);
  }

  if (state.m5Scenario !== undefined) {
    return createM5WorkerFocusedSaveEnvelope(state.m5Scenario.seed, state.tick);
  }

  return undefined;
}

interface FocusedSaveEnvelopeView {
  readonly scenarioId: string;
  readonly createdTick: number;
  readonly worldHash: string;
}

function readFocusedSaveEnvelope(input: unknown): FocusedSaveEnvelopeView | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const wrapped = input["ok"] === true ? input["save"] : input;
  if (!isRecord(wrapped)) {
    return undefined;
  }

  const sections = wrapped["sections"];
  if (!isRecord(sections)) {
    return undefined;
  }

  const commandLogTail = sections["commandLogTail"];
  if (!isRecord(commandLogTail)) {
    return undefined;
  }

  const scenarioId = wrapped["scenarioId"];
  const createdTick = wrapped["createdTick"];
  const worldHash = commandLogTail["checkpointWorldHash"];
  if (
    typeof scenarioId !== "string" ||
    typeof createdTick !== "number" ||
    typeof worldHash !== "string"
  ) {
    return undefined;
  }

  return {
    scenarioId,
    createdTick,
    worldHash,
  };
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

export function createM2WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (const tick of checkpointTicks) {
    commandIds.push(createM2AdvanceCommandId(tick));
  }

  return commandIds;
}

export function createM3WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (const tick of checkpointTicks) {
    commandIds.push(createM3AdvanceCommandId(tick));
  }

  return commandIds;
}

export function createM4WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (let index = 0; index < checkpointTicks.length; index += 1) {
    const tick = checkpointTicks[index];
    if (tick !== undefined) {
      commandIds.push(createM4AdvanceCommandId(tick, index));
    }
  }

  return commandIds;
}

export function createM5WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (let index = 0; index < checkpointTicks.length; index += 1) {
    const tick = checkpointTicks[index];
    if (tick !== undefined) {
      commandIds.push(createM5WorkerAdvanceCommandId(tick, index));
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
