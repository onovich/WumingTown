import {
  WM0150_PLAYABLE_COMMAND_SCENARIO_ID,
  createBrowserSimulationWorkerSession,
  type BrowserSimulationWorkerSession,
  type BrowserSimulationWorkerSessionOptions,
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

export function readWebPlayableProjection(
  message: SimulationToMainMessage,
): WebPlayableProjection | undefined {
  return message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta
    ? message.payload.playable
    : undefined;
}
