import {
  PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
  PR1_INTEGRATED_GAME_SESSION_ALIAS,
  createPlayableAdvanceCommandId,
} from "@wuming-town/sim-core";
import {
  GAME_SESSION_PROJECTION_VERSION,
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type InitSessionPayload,
  type LoadSessionPayload,
  type MainToSimulationMessage,
  type PlayerCommand,
  type RequestSavePayload,
  type RequestUiDetailPayload,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import { GameSessionBrowserProjectionValidator } from "./game-session-browser-validation";
import {
  assertCanPost,
  assertPlayableAdvanceTargetTick,
  emitListeners,
  isReliableSimulationWorkerMessage,
  isSimulationToMainMessage,
  subscribe,
  type ReliableSimulationWorkerMessage,
} from "./game-session-browser-session-support";

export type { ReliableSimulationWorkerMessage } from "./game-session-browser-session-support";

import {
  drainPlayableCommandsToTerminal as drainPlayableCommandsToTerminalImpl,
  waitForPlayableProjectionAtOrBeyondTick as waitForPlayableProjectionAtOrBeyondTickImpl,
  type PlayableDrainRequest,
  type PlayableDrainResult,
  type PlayableProjectionWaitRequest,
  type PlayableProjectionWaitResult,
} from "./playable-drain";

export const WM0150_PLAYABLE_COMMAND_SCENARIO_ID = PLAYABLE_COMMAND_SLICE_SCENARIO_ID;
export const WM0150_PLAYABLE_COMMAND_DEFAULT_SEED = "5";
export const PR1_GAME_SESSION_SCENARIO_ID = PR1_INTEGRATED_GAME_SESSION_ALIAS;
export const PR1_GAME_SESSION_DEFAULT_SEED = "5";

export type BrowserSimulationWorkerSessionState =
  | "created"
  | "initializing"
  | "active"
  | "shutdown"
  | "fatal"
  | "destroyed";

export interface BrowserSimulationWorkerMessageEvent {
  readonly data: unknown;
}

export interface BrowserSimulationWorkerHandle {
  postMessage(message: MainToSimulationMessage): void;
  addEventListener(
    type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void;
  terminate(): void;
}

export type BrowserSimulationWorkerFactory = () => BrowserSimulationWorkerHandle;
export type BrowserSimulationWorkerMessageListener = (message: SimulationToMainMessage) => void;
export type ReliableSimulationWorkerMessageListener = (
  message: ReliableSimulationWorkerMessage,
) => void;
export type BrowserSimulationWorkerLifecycleListener = (
  event: BrowserSimulationWorkerLifecycleEvent,
) => void;

export interface BrowserSimulationWorkerSessionOptions {
  readonly sessionId: string;
  readonly workerFactory?: BrowserSimulationWorkerFactory;
}

export interface InitPlayableCommandScenarioInput {
  readonly seed?: string;
}

export interface InitGameSessionInput {
  readonly seed?: string;
}

export interface BrowserSimulationWorkerLifecycleEvent {
  readonly state: BrowserSimulationWorkerSessionState;
}

export interface BrowserSimulationWorkerSession {
  readonly sessionId: string;
  getState(): BrowserSimulationWorkerSessionState;
  subscribe(listener: BrowserSimulationWorkerMessageListener): () => void;
  subscribeReliable(listener: ReliableSimulationWorkerMessageListener): () => void;
  subscribeLifecycle(listener: BrowserSimulationWorkerLifecycleListener): () => void;
  initSession(payload: InitSessionPayload): MainToSimulationMessage;
  initPlayableCommandScenario(input?: InitPlayableCommandScenarioInput): MainToSimulationMessage;
  initGameSession(input?: InitGameSessionInput): MainToSimulationMessage;
  loadSession(payload: LoadSessionPayload): MainToSimulationMessage;
  sendPlayerCommandBatch(commands: readonly PlayerCommand[]): MainToSimulationMessage;
  advancePlayableCommandScenarioToTick(targetTick: number): MainToSimulationMessage;
  waitForPlayableProjectionAtOrBeyondTick(
    request: PlayableProjectionWaitRequest,
  ): Promise<PlayableProjectionWaitResult>;
  drainPlayableCommandsToTerminal(request: PlayableDrainRequest): Promise<PlayableDrainResult>;
  requestUiDetail(payload: RequestUiDetailPayload): MainToSimulationMessage;
  requestSave(payload: RequestSavePayload): MainToSimulationMessage;
  setSpeed(speed: 0 | 1 | 2 | 3): MainToSimulationMessage;
  pause(paused: boolean): MainToSimulationMessage;
  shutdown(): MainToSimulationMessage;
  destroy(): void;
}

type BrowserSimulationWorkerConstructor = new (
  url: URL,
  options: { readonly type: "module" },
) => BrowserSimulationWorkerHandle;

declare const Worker: BrowserSimulationWorkerConstructor | undefined;

export function createBrowserSimulationWorker(): BrowserSimulationWorkerHandle {
  if (typeof Worker === "undefined") {
    throw new Error("Browser Simulation Worker is unavailable in this runtime.");
  }

  return new Worker(new URL("./browser-worker-entry.ts", import.meta.url), {
    type: "module",
  });
}

export function createBrowserSimulationWorkerSession(
  options: BrowserSimulationWorkerSessionOptions,
): BrowserSimulationWorkerSession {
  let nextSequence = 1;
  let state: BrowserSimulationWorkerSessionState = "created";
  let lastWorkerSequence = 0;
  const projectionValidator = new GameSessionBrowserProjectionValidator();
  const messageListeners: BrowserSimulationWorkerMessageListener[] = [];
  const reliableListeners: ReliableSimulationWorkerMessageListener[] = [];
  const lifecycleListeners: BrowserSimulationWorkerLifecycleListener[] = [];
  const workerFactory = options.workerFactory ?? createBrowserSimulationWorker;
  const worker = workerFactory();

  const onMessage = (event: BrowserSimulationWorkerMessageEvent): void => {
    if (!isSimulationToMainMessage(event.data)) {
      failClosed("Worker message envelope or schema is invalid");
      return;
    }

    const message = event.data;
    if (message.sessionId !== options.sessionId) {
      failClosed("Worker message session id does not match the browser session");
      return;
    }
    if (projectionValidator.isDroppableStaleRender(message)) return;
    if (message.sequence <= lastWorkerSequence) {
      failClosed("Worker message sequence is stale or duplicated");
      return;
    }
    const projectionValidation = projectionValidator.validate(message);
    if (!projectionValidation.ok) {
      failClosed(projectionValidation.detail);
      return;
    }
    lastWorkerSequence = message.sequence;
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.Ready && state === "initializing") {
      setState("active");
    }

    emitListeners(messageListeners, message);
    if (isReliableSimulationWorkerMessage(message)) {
      emitListeners(reliableListeners, message);
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError) {
      closeWorker("fatal");
    }
  };

  worker.addEventListener("message", onMessage);

  const post = (message: MainToSimulationMessage): MainToSimulationMessage => {
    assertCanPost(state);
    worker.postMessage(message);
    return message;
  };

  const nextBase = (): Pick<
    MainToSimulationMessage,
    "protocolVersion" | "schemaVersion" | "sessionId" | "sequence"
  > => {
    const sequence = nextSequence;
    nextSequence += 1;
    return {
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: options.sessionId,
      sequence,
    };
  };

  return {
    sessionId: options.sessionId,
    getState(): BrowserSimulationWorkerSessionState {
      return state;
    },
    subscribe(listener: BrowserSimulationWorkerMessageListener): () => void {
      return subscribe(messageListeners, listener);
    },
    subscribeReliable(listener: ReliableSimulationWorkerMessageListener): () => void {
      return subscribe(reliableListeners, listener);
    },
    subscribeLifecycle(listener: BrowserSimulationWorkerLifecycleListener): () => void {
      return subscribe(lifecycleListeners, listener);
    },
    initSession(payload: InitSessionPayload): MainToSimulationMessage {
      assertCanPost(state);
      projectionValidator.reset(payload.projectionRequest ?? null);
      const message: MainToSimulationMessage = {
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
        payload,
      };
      setState(payload.projectionRequest === undefined ? "active" : "initializing");
      worker.postMessage(message);
      return message;
    },
    initPlayableCommandScenario(input?: InitPlayableCommandScenarioInput): MainToSimulationMessage {
      return this.initSession({
        seed: input?.seed ?? WM0150_PLAYABLE_COMMAND_DEFAULT_SEED,
        catalogVersion: WM0150_PLAYABLE_COMMAND_SCENARIO_ID,
      });
    },
    initGameSession(input?: InitGameSessionInput): MainToSimulationMessage {
      return this.initSession({
        seed: input?.seed ?? PR1_GAME_SESSION_DEFAULT_SEED,
        catalogVersion: PR1_GAME_SESSION_SCENARIO_ID,
        projectionRequest: {
          kind: "game_session",
          version: GAME_SESSION_PROJECTION_VERSION,
        },
      });
    },
    loadSession(payload: LoadSessionPayload): MainToSimulationMessage {
      assertCanPost(state);
      projectionValidator.reset(null);
      const message: MainToSimulationMessage = {
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
        payload,
      };
      setState("active");
      worker.postMessage(message);
      return message;
    },
    sendPlayerCommandBatch(commands: readonly PlayerCommand[]): MainToSimulationMessage {
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
        payload: { commands },
      });
    },
    advancePlayableCommandScenarioToTick(targetTick: number): MainToSimulationMessage {
      assertPlayableAdvanceTargetTick(targetTick);
      return this.sendPlayerCommandBatch([
        {
          commandId: createPlayableAdvanceCommandId(targetTick),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ]);
    },
    waitForPlayableProjectionAtOrBeyondTick(
      request: PlayableProjectionWaitRequest,
    ): Promise<PlayableProjectionWaitResult> {
      return waitForPlayableProjectionAtOrBeyondTickImpl(this, request);
    },
    drainPlayableCommandsToTerminal(request: PlayableDrainRequest): Promise<PlayableDrainResult> {
      return drainPlayableCommandsToTerminalImpl(this, request);
    },
    requestUiDetail(payload: RequestUiDetailPayload): MainToSimulationMessage {
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
        payload,
      });
    },
    requestSave(payload: RequestSavePayload): MainToSimulationMessage {
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
        payload,
      });
    },
    setSpeed(speed: 0 | 1 | 2 | 3): MainToSimulationMessage {
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed,
        payload: { speed },
      });
    },
    pause(paused: boolean): MainToSimulationMessage {
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Pause,
        payload: { paused },
      });
    },
    shutdown(): MainToSimulationMessage {
      const message = post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown,
        payload: { reason: "client-request" },
      });
      setState("shutdown");
      return message;
    },
    destroy(): void {
      if (state === "destroyed") {
        return;
      }
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      setState("destroyed");
    },
  };

  function setState(nextState: BrowserSimulationWorkerSessionState): void {
    state = nextState;
    emitListeners(lifecycleListeners, { state });
  }

  function failClosed(detail: string): void {
    if (state === "fatal" || state === "destroyed") return;
    const fatal: SimulationToMainMessage = {
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: options.sessionId,
      sequence: lastWorkerSequence + 1,
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
      payload: {
        reason: { code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError, detail },
      },
    };
    lastWorkerSequence = fatal.sequence;
    emitListeners(messageListeners, fatal);
    emitListeners(reliableListeners, fatal);
    closeWorker("fatal");
  }

  function closeWorker(nextState: "fatal"): void {
    worker.removeEventListener("message", onMessage);
    worker.terminate();
    setState(nextState);
  }
}

export function advancePlayableCommandScenarioToTick(
  session: BrowserSimulationWorkerSession,
  targetTick: number,
): MainToSimulationMessage {
  return session.advancePlayableCommandScenarioToTick(targetTick);
}

export function waitForPlayableProjectionAtOrBeyondTick(
  session: BrowserSimulationWorkerSession,
  request: PlayableProjectionWaitRequest,
): Promise<PlayableProjectionWaitResult> {
  return session.waitForPlayableProjectionAtOrBeyondTick(request);
}

export function drainPlayableCommandsToTerminal(
  session: BrowserSimulationWorkerSession,
  request: PlayableDrainRequest,
): Promise<PlayableDrainResult> {
  return session.drainPlayableCommandsToTerminal(request);
}
