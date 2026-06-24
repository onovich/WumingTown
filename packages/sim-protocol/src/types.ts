import type {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
} from "./constants";

export type MainToSimulationMessageKind =
  (typeof MAIN_TO_SIMULATION_MESSAGE_KIND)[keyof typeof MAIN_TO_SIMULATION_MESSAGE_KIND];
export type SimulationToMainMessageKind =
  (typeof SIMULATION_TO_MAIN_MESSAGE_KIND)[keyof typeof SIMULATION_TO_MAIN_MESSAGE_KIND];
export type SimulationProtocolReasonCode =
  (typeof SIMULATION_PROTOCOL_REASON_CODE)[keyof typeof SIMULATION_PROTOCOL_REASON_CODE];

export interface ProtocolRejection {
  readonly code: SimulationProtocolReasonCode;
  readonly detail: string;
}

export interface ProtocolEnvelope<K extends string, P> {
  readonly protocolVersion: number;
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly sequence: number;
  readonly kind: K;
  readonly payload: P;
}

export interface InitSessionPayload {
  readonly seed: string;
  readonly catalogVersion: string;
}

export interface LoadSessionPayload {
  readonly saveId: string;
  readonly checkpointSequence: number;
}

export type PlayerCommandKind = (typeof PLAYER_COMMAND_KIND)[keyof typeof PLAYER_COMMAND_KIND];

export interface PlayerCommand {
  readonly commandId: string;
  readonly kind: PlayerCommandKind;
}

export interface PlayerCommandBatchPayload {
  readonly commands: readonly PlayerCommand[];
}

export interface SetSpeedPayload {
  readonly speed: 0 | 1 | 2 | 3;
}

export interface PausePayload {
  readonly paused: boolean;
}

export type UiDetailSubject =
  | {
      readonly kind: "session";
    }
  | {
      readonly kind: "entity";
      readonly entityId: string;
    };

export interface RequestUiDetailPayload {
  readonly subject: UiDetailSubject;
}

export interface RequestSavePayload {
  readonly reason: "manual" | "autosave";
}

export interface DevCommandPayload {
  readonly command: "echo";
  readonly text: string;
}

export interface ShutdownPayload {
  readonly reason: "client-request";
}

export type InitSessionMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
  InitSessionPayload
>;
export type LoadSessionMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
  LoadSessionPayload
>;
export type PlayerCommandBatchMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
  PlayerCommandBatchPayload
>;
export type SetSpeedMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed,
  SetSpeedPayload
>;
export type PauseMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.Pause,
  PausePayload
>;
export type RequestUiDetailMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
  RequestUiDetailPayload
>;
export type RequestSaveMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
  RequestSavePayload
>;
export type DevCommandMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand,
  DevCommandPayload
>;
export type ShutdownMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown,
  ShutdownPayload
>;

export type MainToSimulationMessage =
  | InitSessionMessage
  | LoadSessionMessage
  | PlayerCommandBatchMessage
  | SetSpeedMessage
  | PauseMessage
  | RequestUiDetailMessage
  | RequestSaveMessage
  | DevCommandMessage
  | ShutdownMessage;

export interface ReadyPayload {
  readonly acceptedProtocolVersion: number;
  readonly acceptedSchemaVersion: number;
  readonly status: "ready";
}

export interface RenderSnapshotPayload {
  readonly snapshotSequence: number;
  readonly tick: number;
  readonly entityCount: number;
  readonly scenarioId?: string;
  readonly worldHash?: string;
  readonly readModelHash?: string;
  readonly readOnly?: true;
}

export interface UiDeltaPayload {
  readonly tick: number;
  readonly summaries: readonly string[];
  readonly scenarioId?: string;
  readonly readModelHash?: string;
  readonly detailHash?: string;
  readonly readOnly?: true;
}

export interface CommandResultPayload {
  readonly inReplyToSequence: number;
  readonly accepted: boolean;
  readonly reason?: ProtocolRejection;
}

export interface AlertBatchPayload {
  readonly alerts: readonly ProtocolRejection[];
}

export interface SaveReadyPayload {
  readonly saveId: string;
  readonly sourceSequence: number;
  readonly scenarioId?: string;
  readonly checkpointTick?: number;
  readonly worldHash?: string;
}

export interface MetricsSamplePayload {
  readonly tick: number;
  readonly droppedSnapshots: number;
  readonly queuedReliableMessages: number;
  readonly scenarioId?: string;
  readonly worldHash?: string;
  readonly checkpointCount?: number;
}

export interface FatalSimulationErrorPayload {
  readonly reason: ProtocolRejection;
}

export type ReadyMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
  ReadyPayload
>;
export type RenderSnapshotMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
  RenderSnapshotPayload
>;
export type UiDeltaMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
  UiDeltaPayload
>;
export type CommandResultMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
  CommandResultPayload
>;
export type AlertBatchMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch,
  AlertBatchPayload
>;
export type SaveReadyMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
  SaveReadyPayload
>;
export type MetricsSampleMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
  MetricsSamplePayload
>;
export type FatalSimulationErrorMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
  FatalSimulationErrorPayload
>;

export type SimulationToMainMessage =
  | ReadyMessage
  | RenderSnapshotMessage
  | UiDeltaMessage
  | CommandResultMessage
  | AlertBatchMessage
  | SaveReadyMessage
  | MetricsSampleMessage
  | FatalSimulationErrorMessage;

export type MainMessageValidationResult =
  | {
      readonly ok: true;
      readonly message: MainToSimulationMessage;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
      readonly observedSessionId: string;
      readonly observedSequence: number;
    };
