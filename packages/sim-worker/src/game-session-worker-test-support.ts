import { PR1_INTEGRATED_GAME_SESSION_ALIAS } from "@wuming-town/sim-core";
import {
  GAME_SESSION_PROJECTION_VERSION,
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  validateCoherentGameSessionProjectionPair,
  type GameSessionRenderProjectionV1,
  type GameSessionUiProjectionV1,
  type LoadSessionMessage,
  type MainToSimulationMessage,
  type PauseMessage,
  type ReadyMessage,
  type RenderSnapshotMessage,
  type RequestSaveMessage,
  type RequestUiDetailMessage,
  type SetSpeedMessage,
  type ShutdownMessage,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import type {
  BrowserSimulationWorkerHandle,
  BrowserSimulationWorkerMessageEvent,
  SimulationWorkerMessageEvent,
  SimulationWorkerPort,
} from "./index";

export class FakeBrowserWorker implements BrowserSimulationWorkerHandle {
  readonly posted: MainToSimulationMessage[] = [];
  terminateCount = 0;
  private readonly listeners: ((event: BrowserSimulationWorkerMessageEvent) => void)[] = [];

  postMessage(message: MainToSimulationMessage): void {
    this.posted.push(message);
  }

  addEventListener(
    _type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    this.listeners.push(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  emit(message: unknown): void {
    const snapshot = [...this.listeners];
    for (const listener of snapshot) listener({ data: message });
  }
}

export class RecordingSimulationWorkerPort implements SimulationWorkerPort {
  readonly messages: SimulationToMainMessage[] = [];
  removeCount = 0;
  private listener: ((event: SimulationWorkerMessageEvent) => void) | undefined;

  postMessage(message: SimulationToMainMessage): void {
    this.messages.push(message);
  }

  addEventListener(
    _type: "message",
    listener: (event: SimulationWorkerMessageEvent) => void,
  ): void {
    this.listener = listener;
  }

  removeEventListener(
    _type: "message",
    listener: (event: SimulationWorkerMessageEvent) => void,
  ): void {
    this.removeCount += 1;
    if (this.listener === listener) this.listener = undefined;
  }

  dispatch(message: MainToSimulationMessage): void {
    const listener = this.listener;
    if (listener === undefined) throw new Error("Simulation Worker port listener missing");
    listener({ data: message });
  }
}

export function initMessage(): MainToSimulationMessage {
  return {
    ...base(1),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "5",
      catalogVersion: PR1_INTEGRATED_GAME_SESSION_ALIAS,
      projectionRequest: { kind: "game_session", version: GAME_SESSION_PROJECTION_VERSION },
    },
  };
}

export function legacyInitMessage(): MainToSimulationMessage {
  return {
    ...base(1),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: { seed: "legacy", catalogVersion: "catalog-legacy" },
  };
}

export function commandMessage(sequence: number, commandId: string): MainToSimulationMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: { commands: [{ commandId, kind: PLAYER_COMMAND_KIND.Noop }] },
  };
}

export function emptyCommandBatchMessage(sequence: number): MainToSimulationMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: { commands: [] },
  };
}

export function mixedUnsupportedBatchMessage(sequence: number): MainToSimulationMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        { commandId: "must-not-leak", kind: PLAYER_COMMAND_KIND.Noop },
        {
          commandId: "unsupported-gameplay",
          kind: PLAYER_COMMAND_KIND.PrioritizeLampWork,
          payload: {
            target: {
              kind: "lamp_gap",
              gapId: "lamp-gap-0",
              anchorCell: { x: 1, y: 1, cellIndex: 65 },
            },
            requestedAction: "auto",
            priorityBand: 1,
          },
          basis: {
            playableCommandContractVersion: 1,
            basisTick: 0,
            basisSnapshotSequence: 1,
            basisReadModelHash: "0xread",
            contentManifestHash: "0xf625e427",
          },
        },
      ],
    },
  };
}

export function setSpeedMessage(sequence: number, speed: 0 | 1 | 2 | 3): SetSpeedMessage {
  return { ...base(sequence), kind: MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed, payload: { speed } };
}

export function pauseMessage(sequence: number, paused: boolean): PauseMessage {
  return { ...base(sequence), kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Pause, payload: { paused } };
}

export function requestSaveMessage(sequence: number): RequestSaveMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
    payload: { reason: "manual" },
  };
}

export function requestUiDetailMessage(
  sequence: number,
  entity: { readonly index: number; readonly generation: number },
): RequestUiDetailMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
    payload: {
      subject: { kind: "entity", entityId: `${String(entity.index)}:${String(entity.generation)}` },
    },
  };
}

export function gameSessionLoadMessage(): LoadSessionMessage {
  return {
    ...base(1),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
    payload: { saveId: "game-session:v1:unsupported", checkpointSequence: 0 },
  };
}

export function shutdownMessage(sequence: number): ShutdownMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown,
    payload: { reason: "client-request" },
  };
}

function base(sequence: number): {
  readonly protocolVersion: 1;
  readonly schemaVersion: 3;
  readonly sessionId: "session-a";
  readonly sequence: number;
} {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
  };
}

export function findRender(messages: readonly SimulationToMainMessage[]): RenderSnapshotMessage {
  for (const message of messages) if (message.kind === "RenderSnapshot") return message;
  throw new Error("RenderSnapshot missing");
}

export function findUi(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  for (const message of messages) if (message.kind === "UiDelta") return message;
  throw new Error("UiDelta missing");
}

export function findReady(messages: readonly SimulationToMainMessage[]): ReadyMessage {
  for (const message of messages) if (message.kind === "Ready") return message;
  throw new Error("Ready missing");
}

export function readLatestUi(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  let latest: UiDeltaMessage | undefined;
  for (const message of messages) if (message.kind === "UiDelta") latest = message;
  if (latest === undefined) throw new Error("UiDelta missing");
  return latest;
}

export function readLatestTick(messages: readonly SimulationToMainMessage[]): number {
  return readLatestUi(messages).payload.gameSession?.basis.tick ?? -1;
}

export function readProjectionPair(
  render: RenderSnapshotMessage,
  ui: UiDeltaMessage,
): ReturnType<typeof validateCoherentGameSessionProjectionPair> {
  const renderProjection: GameSessionRenderProjectionV1 | undefined = render.payload.gameSession;
  const uiProjection: GameSessionUiProjectionV1 | undefined = ui.payload.gameSession;
  if (renderProjection === undefined || uiProjection === undefined) {
    throw new Error("projection missing");
  }
  return validateCoherentGameSessionProjectionPair(renderProjection, uiProjection);
}

export function countKind(messages: readonly SimulationToMainMessage[], kind: string): number {
  let count = 0;
  for (const message of messages) if (message.kind === kind) count += 1;
  return count;
}

export function isStrictlyIncreasingSequence(
  messages: readonly SimulationToMainMessage[],
): boolean {
  let previous = 0;
  for (const message of messages) {
    if (message.sequence <= previous) return false;
    previous = message.sequence;
  }
  return true;
}
