import {
  PR1_GAME_SESSION_DEFAULT_SEED,
  PR1_GAME_SESSION_SCENARIO_ID,
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
  type GameSessionRenderProjectionV1,
  type GameSessionUiProjectionV1,
  type MainToSimulationMessage,
  type PlayableProjectionV1,
  type PlayerCommand,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export const WEB_PLAYABLE_WORKER_SCENARIO_ID = WM0150_PLAYABLE_COMMAND_SCENARIO_ID;
export const WEB_GAME_SESSION_SCENARIO_ID = PR1_GAME_SESSION_SCENARIO_ID;
export const WEB_GAME_SESSION_DEFAULT_SEED = PR1_GAME_SESSION_DEFAULT_SEED;
export type WebGameSessionRenderProjection = GameSessionRenderProjectionV1;
export type WebGameSessionUiProjection = GameSessionUiProjectionV1;
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

export function startWebGameSession(
  session: BrowserSimulationWorkerSession,
  seed: string = WEB_GAME_SESSION_DEFAULT_SEED,
): MainToSimulationMessage {
  return session.initGameSession({ seed });
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

export function readWebGameSessionRenderProjection(
  message: SimulationToMainMessage,
): WebGameSessionRenderProjection | undefined {
  return message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot
    ? message.payload.gameSession
    : undefined;
}

export function readWebGameSessionUiProjection(
  message: SimulationToMainMessage,
): WebGameSessionUiProjection | undefined {
  return message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta
    ? message.payload.gameSession
    : undefined;
}
