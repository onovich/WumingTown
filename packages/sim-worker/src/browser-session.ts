import {
  PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
  createPlayableAdvanceCommandId,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type InitSessionPayload,
  type LoadSessionPayload,
  type MainToSimulationMessage,
  type PlayerCommand,
  type RequestSavePayload,
  type RequestUiDetailPayload,
  type SaveReadyMessage,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export const WM0150_PLAYABLE_COMMAND_SCENARIO_ID = PLAYABLE_COMMAND_SLICE_SCENARIO_ID;
export const WM0150_PLAYABLE_COMMAND_DEFAULT_SEED = "5";

export type BrowserSimulationWorkerSessionState = "created" | "active" | "shutdown" | "destroyed";

export type ReliableSimulationWorkerMessage =
  | Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult }
    >
  | SaveReadyMessage
  | Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError }
    >;

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

export interface BrowserSimulationWorkerSessionOptions {
  readonly sessionId: string;
  readonly workerFactory?: BrowserSimulationWorkerFactory;
}

export interface InitPlayableCommandScenarioInput {
  readonly seed?: string;
}

export interface BrowserSimulationWorkerSession {
  readonly sessionId: string;
  getState(): BrowserSimulationWorkerSessionState;
  subscribe(listener: BrowserSimulationWorkerMessageListener): () => void;
  subscribeReliable(listener: ReliableSimulationWorkerMessageListener): () => void;
  initSession(payload: InitSessionPayload): MainToSimulationMessage;
  initPlayableCommandScenario(input?: InitPlayableCommandScenarioInput): MainToSimulationMessage;
  loadSession(payload: LoadSessionPayload): MainToSimulationMessage;
  sendPlayerCommandBatch(commands: readonly PlayerCommand[]): MainToSimulationMessage;
  advancePlayableCommandScenarioToTick(targetTick: number): MainToSimulationMessage;
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
  const messageListeners: BrowserSimulationWorkerMessageListener[] = [];
  const reliableListeners: ReliableSimulationWorkerMessageListener[] = [];
  const workerFactory = options.workerFactory ?? createBrowserSimulationWorker;
  const worker = workerFactory();

  const onMessage = (event: BrowserSimulationWorkerMessageEvent): void => {
    if (!isSimulationToMainMessage(event.data)) {
      return;
    }

    emitMessage(messageListeners, event.data);
    if (isReliableSimulationWorkerMessage(event.data)) {
      emitReliableMessage(reliableListeners, event.data);
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
    initSession(payload: InitSessionPayload): MainToSimulationMessage {
      state = "active";
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
        payload,
      });
    },
    initPlayableCommandScenario(input?: InitPlayableCommandScenarioInput): MainToSimulationMessage {
      return this.initSession({
        seed: input?.seed ?? WM0150_PLAYABLE_COMMAND_DEFAULT_SEED,
        catalogVersion: WM0150_PLAYABLE_COMMAND_SCENARIO_ID,
      });
    },
    loadSession(payload: LoadSessionPayload): MainToSimulationMessage {
      state = "active";
      return post({
        ...nextBase(),
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
        payload,
      });
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
      state = "shutdown";
      return message;
    },
    destroy(): void {
      if (state === "destroyed") {
        return;
      }
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      state = "destroyed";
    },
  };
}

export function advancePlayableCommandScenarioToTick(
  session: BrowserSimulationWorkerSession,
  targetTick: number,
): MainToSimulationMessage {
  return session.advancePlayableCommandScenarioToTick(targetTick);
}

function assertCanPost(state: BrowserSimulationWorkerSessionState): void {
  if (state === "destroyed") {
    throw new Error("Browser Simulation Worker session has been destroyed.");
  }

  if (state === "shutdown") {
    throw new Error("Browser Simulation Worker session has already been shut down.");
  }
}

function assertPlayableAdvanceTargetTick(targetTick: number): void {
  if (!Number.isSafeInteger(targetTick) || targetTick < 0) {
    throw new Error("Playable Worker advance target tick must be a non-negative safe integer.");
  }
}

function subscribe<T>(listeners: T[], listener: T): () => void {
  listeners.push(listener);
  return (): void => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

function emitMessage(
  listeners: readonly BrowserSimulationWorkerMessageListener[],
  message: SimulationToMainMessage,
): void {
  for (const listener of listeners) {
    listener(message);
  }
}

function emitReliableMessage(
  listeners: readonly ReliableSimulationWorkerMessageListener[],
  message: ReliableSimulationWorkerMessage,
): void {
  for (const listener of listeners) {
    listener(message);
  }
}

function isSimulationToMainMessage(value: unknown): value is SimulationToMainMessage {
  if (!isRecord(value) || !isRecord(value["payload"])) {
    return false;
  }

  const kind = value["kind"];
  return (
    value["protocolVersion"] === SIM_PROTOCOL_VERSION &&
    value["schemaVersion"] === SIM_SCHEMA_VERSION &&
    typeof value["sessionId"] === "string" &&
    typeof value["sequence"] === "number" &&
    (kind === SIMULATION_TO_MAIN_MESSAGE_KIND.Ready ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample ||
      kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError)
  );
}

function isReliableSimulationWorkerMessage(
  message: SimulationToMainMessage,
): message is ReliableSimulationWorkerMessage {
  return (
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult ||
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady ||
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
