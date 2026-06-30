import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type MainToSimulationMessage,
  type PlayableProjectionV1,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import type {
  BrowserSimulationWorkerLifecycleEvent,
  BrowserSimulationWorkerSession,
} from "./browser-session";

export type PlayableProjectionWaitStatus = "advanced";
export type PlayableDrainStatus = "terminal" | "max_target_reached";
export type PlayableDrainOrderState = PlayableProjectionV1["orders"][number]["markerState"];

export interface PlayableProjectionWaitRequest {
  readonly targetTick: number;
  readonly signal?: AbortSignal;
}

export interface PlayableProjectionWaitResult {
  readonly status: PlayableProjectionWaitStatus;
  readonly targetTick: number;
  readonly uiDelta: UiDeltaMessage;
  readonly projection: PlayableProjectionV1;
  readonly postedMessages: readonly MainToSimulationMessage[];
}

export interface PlayableDrainRequest {
  readonly commandIds: readonly string[];
  readonly maxTargetTick: number;
  readonly stepTicks: number;
  readonly signal?: AbortSignal;
}

export interface PlayableDrainResult {
  readonly status: PlayableDrainStatus;
  readonly targetTick: number;
  readonly uiDelta: UiDeltaMessage;
  readonly projection: PlayableProjectionV1;
  readonly postedMessages: readonly MainToSimulationMessage[];
  readonly terminalCommandIds: readonly string[];
  readonly activeCommandIds: readonly string[];
  readonly missingCommandIds: readonly string[];
}

interface PlayableUiDeltaView {
  readonly uiDelta: UiDeltaMessage;
  readonly projection: PlayableProjectionV1;
}

interface PlayableDrainState {
  readonly terminal: boolean;
  readonly terminalCommandIds: readonly string[];
  readonly activeCommandIds: readonly string[];
  readonly missingCommandIds: readonly string[];
}

const TERMINAL_ORDER_STATES: readonly PlayableDrainOrderState[] = [
  "blocked",
  "completed",
  "failed",
  "canceled",
];

export function waitForPlayableProjectionAtOrBeyondTick(
  session: BrowserSimulationWorkerSession,
  request: PlayableProjectionWaitRequest,
): Promise<PlayableProjectionWaitResult> {
  assertTargetTick(request.targetTick, "targetTick");

  return new Promise((resolve, reject) => {
    const postedMessages: MainToSimulationMessage[] = [];
    let unsubscribeMessages: (() => void) | undefined;
    let unsubscribeLifecycle: (() => void) | undefined;
    let settled = false;
    let posting = false;
    let pendingResolution: PlayableUiDeltaView | undefined;

    const cleanup = (): void => {
      unsubscribeMessages?.();
      unsubscribeLifecycle?.();
      request.signal?.removeEventListener("abort", abort);
      unsubscribeMessages = undefined;
      unsubscribeLifecycle = undefined;
    };

    const fail = (reason: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(reason);
    };

    const finish = (view: PlayableUiDeltaView): void => {
      if (settled) {
        return;
      }
      if (posting) {
        pendingResolution = view;
        return;
      }
      settled = true;
      cleanup();
      resolve({
        status: "advanced",
        targetTick: request.targetTick,
        uiDelta: view.uiDelta,
        projection: view.projection,
        postedMessages: [...postedMessages],
      });
    };

    const abort = (): void => {
      fail(readAbortError(request.signal));
    };

    const onMessage = (message: SimulationToMainMessage): void => {
      const view = readPlayableUiDelta(message);
      if (view !== undefined && view.projection.basis.tick >= request.targetTick) {
        finish(view);
      }
    };

    const onLifecycle = (event: BrowserSimulationWorkerLifecycleEvent): void => {
      if (event.state === "shutdown" || event.state === "destroyed") {
        fail(new Error(`Playable projection wait stopped because session is ${event.state}.`));
      }
    };

    if (request.signal?.aborted === true) {
      fail(readAbortError(request.signal));
      return;
    }

    request.signal?.addEventListener("abort", abort);
    unsubscribeMessages = session.subscribe(onMessage);
    unsubscribeLifecycle = session.subscribeLifecycle(onLifecycle);

    try {
      posting = true;
      postedMessages.push(session.advancePlayableCommandScenarioToTick(request.targetTick));
      posting = false;
      if (pendingResolution !== undefined) {
        finish(pendingResolution);
      }
    } catch (error) {
      posting = false;
      fail(toError(error));
    }
  });
}

export function drainPlayableCommandsToTerminal(
  session: BrowserSimulationWorkerSession,
  request: PlayableDrainRequest,
): Promise<PlayableDrainResult> {
  const commandIds = readCommandIds(request.commandIds);
  assertTargetTick(request.maxTargetTick, "maxTargetTick");
  assertPositiveTickStep(request.stepTicks);

  return new Promise((resolve, reject) => {
    const postedMessages: MainToSimulationMessage[] = [];
    let unsubscribeMessages: (() => void) | undefined;
    let unsubscribeLifecycle: (() => void) | undefined;
    let settled = false;
    let posting = false;
    let processing = false;
    let inFlightTarget: number | undefined;
    let pendingView: PlayableUiDeltaView | undefined;

    const cleanup = (): void => {
      unsubscribeMessages?.();
      unsubscribeLifecycle?.();
      request.signal?.removeEventListener("abort", abort);
      unsubscribeMessages = undefined;
      unsubscribeLifecycle = undefined;
    };

    const fail = (reason: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(reason);
    };

    const finish = (
      status: PlayableDrainStatus,
      view: PlayableUiDeltaView,
      state: PlayableDrainState,
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({
        status,
        targetTick: view.projection.basis.tick,
        uiDelta: view.uiDelta,
        projection: view.projection,
        postedMessages: [...postedMessages],
        terminalCommandIds: state.terminalCommandIds,
        activeCommandIds: state.activeCommandIds,
        missingCommandIds: state.missingCommandIds,
      });
    };

    const postAdvance = (targetTick: number): void => {
      inFlightTarget = targetTick;
      try {
        posting = true;
        postedMessages.push(session.advancePlayableCommandScenarioToTick(targetTick));
        posting = false;
      } catch (error) {
        posting = false;
        fail(toError(error));
        return;
      }

      drainPendingViews();
    };

    const drainPendingViews = (): void => {
      if (processing) {
        return;
      }

      processing = true;
      while (pendingView !== undefined && !settled && !posting) {
        const view = pendingView;
        pendingView = undefined;
        processPlayableUiDelta(view);
      }
      processing = false;
    };

    const queuePlayableUiDelta = (view: PlayableUiDeltaView): void => {
      if (settled) {
        return;
      }
      if (posting) {
        pendingView = view;
        return;
      }
      pendingView = view;
      drainPendingViews();
    };

    const processPlayableUiDelta = (view: PlayableUiDeltaView): void => {
      if (inFlightTarget !== undefined && view.projection.basis.tick < inFlightTarget) {
        return;
      }

      inFlightTarget = undefined;
      const state = readDrainState(view.projection, commandIds);
      if (state.terminal) {
        finish("terminal", view, state);
        return;
      }

      const currentTick = view.projection.basis.tick;
      if (currentTick >= request.maxTargetTick) {
        finish("max_target_reached", view, state);
        return;
      }

      postAdvance(Math.min(currentTick + request.stepTicks, request.maxTargetTick));
    };

    const abort = (): void => {
      fail(readAbortError(request.signal));
    };

    const onMessage = (message: SimulationToMainMessage): void => {
      const view = readPlayableUiDelta(message);
      if (view !== undefined) {
        queuePlayableUiDelta(view);
      }
    };

    const onLifecycle = (event: BrowserSimulationWorkerLifecycleEvent): void => {
      if (event.state === "shutdown" || event.state === "destroyed") {
        fail(new Error(`Playable drain stopped because session is ${event.state}.`));
      }
    };

    if (request.signal?.aborted === true) {
      fail(readAbortError(request.signal));
      return;
    }

    request.signal?.addEventListener("abort", abort);
    unsubscribeMessages = session.subscribe(onMessage);
    unsubscribeLifecycle = session.subscribeLifecycle(onLifecycle);
    postAdvance(Math.min(request.stepTicks, request.maxTargetTick));
  });
}

export function isPlayableProjectionTerminalForCommandIds(
  projection: PlayableProjectionV1,
  commandIds: readonly string[],
): boolean {
  return readDrainState(projection, readCommandIds(commandIds)).terminal;
}

function readPlayableUiDelta(message: SimulationToMainMessage): PlayableUiDeltaView | undefined {
  if (message.kind !== SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
    return undefined;
  }

  const projection = message.payload.playable;
  if (projection === undefined) {
    return undefined;
  }

  return {
    uiDelta: message,
    projection,
  };
}

function readDrainState(
  projection: PlayableProjectionV1,
  commandIds: readonly string[],
): PlayableDrainState {
  const terminalCommandIds: string[] = [];
  const activeCommandIds: string[] = [];
  const missingCommandIds: string[] = [];

  for (const commandId of commandIds) {
    const state = readOrderStateForCommandId(projection, commandId);
    if (state === undefined) {
      missingCommandIds.push(commandId);
    } else if (isTerminalOrderState(state)) {
      terminalCommandIds.push(commandId);
    } else {
      activeCommandIds.push(commandId);
    }
  }

  return {
    terminal: activeCommandIds.length === 0 && missingCommandIds.length === 0,
    terminalCommandIds,
    activeCommandIds,
    missingCommandIds,
  };
}

function readOrderStateForCommandId(
  projection: PlayableProjectionV1,
  commandId: string,
): PlayableDrainOrderState | undefined {
  for (const order of projection.orders) {
    if (order.commandId === commandId) {
      return order.markerState;
    }
  }
  return undefined;
}

function isTerminalOrderState(state: PlayableDrainOrderState): boolean {
  return TERMINAL_ORDER_STATES.includes(state);
}

function readCommandIds(commandIds: readonly string[]): readonly string[] {
  if (commandIds.length === 0) {
    throw new Error("Playable drain requires at least one command id.");
  }

  const output: string[] = [];
  for (const commandId of commandIds) {
    if (commandId.length === 0) {
      throw new Error("Playable drain command ids must be non-empty strings.");
    }
    output.push(commandId);
  }
  return output;
}

function assertTargetTick(targetTick: number, field: string): void {
  if (!Number.isSafeInteger(targetTick) || targetTick < 0) {
    throw new Error(`Playable drain ${field} must be a non-negative safe integer.`);
  }
}

function assertPositiveTickStep(stepTicks: number): void {
  if (!Number.isSafeInteger(stepTicks) || stepTicks <= 0) {
    throw new Error("Playable drain stepTicks must be a positive safe integer.");
  }
}

function readAbortError(signal: AbortSignal | undefined): Error {
  const reason: unknown = signal?.reason;
  if (reason instanceof Error) {
    return reason;
  }
  return new Error("Playable drain request was canceled.");
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Playable drain failed with a non-Error rejection.");
}
