import {
  WM0150_PLAYABLE_COMMAND_SCENARIO_ID,
  advancePlayableCommandScenarioToTick,
  createBrowserSimulationWorkerSession,
  drainPlayableCommandsToTerminal,
  waitForPlayableProjectionAtOrBeyondTick,
  type BrowserSimulationWorkerSession,
  type BrowserSimulationWorkerSessionOptions,
  type PlayableDrainRequest,
  type PlayableDrainResult,
  type PlayableProjectionWaitRequest,
  type PlayableProjectionWaitResult,
} from "@wuming-town/sim-worker";
import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type MainToSimulationMessage,
  type PlayableProjectionV1,
  type PlayerCommand,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export const WEB_PLAYABLE_WORKER_SCENARIO_ID = WM0150_PLAYABLE_COMMAND_SCENARIO_ID;
export type WebPlayableProjection = PlayableProjectionV1;
export type WebPlayableProjectionWaitRequest = PlayableProjectionWaitRequest;
export type WebPlayableProjectionWaitResult = PlayableProjectionWaitResult;
export type WebPlayableDrainRequest = PlayableDrainRequest;
export type WebPlayableDrainResult = PlayableDrainResult;

export function createWebSimulationWorkerSession(
  options: BrowserSimulationWorkerSessionOptions,
): BrowserSimulationWorkerSession {
  return createBrowserSimulationWorkerSession(options);
}

export function startWebPlayableWorkerScenario(
  session: BrowserSimulationWorkerSession,
  seed: string,
): MainToSimulationMessage {
  return session.initPlayableCommandScenario({ seed });
}

export function sendWebPlayableCommandBatch(
  session: BrowserSimulationWorkerSession,
  commands: readonly PlayerCommand[],
): MainToSimulationMessage {
  return session.sendPlayerCommandBatch(commands);
}

export function advanceWebPlayableWorkerScenarioToTick(
  session: BrowserSimulationWorkerSession,
  targetTick: number,
): MainToSimulationMessage {
  return advancePlayableCommandScenarioToTick(session, targetTick);
}

export function waitForWebPlayableProjectionAtOrBeyondTick(
  session: BrowserSimulationWorkerSession,
  request: WebPlayableProjectionWaitRequest,
): Promise<WebPlayableProjectionWaitResult> {
  return waitForPlayableProjectionAtOrBeyondTick(session, request);
}

export function drainWebPlayableCommandsToTerminal(
  session: BrowserSimulationWorkerSession,
  request: WebPlayableDrainRequest,
): Promise<WebPlayableDrainResult> {
  return drainPlayableCommandsToTerminal(session, request);
}

export function readWebPlayableProjection(
  message: SimulationToMainMessage,
): WebPlayableProjection | undefined {
  return message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta
    ? message.payload.playable
    : undefined;
}
