import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
} from "./constants";
export { validateMainToSimulationMessage } from "./validation";
export type {
  AlertBatchMessage,
  AlertBatchPayload,
  CommandResultMessage,
  CommandResultPayload,
  DevCommandMessage,
  DevCommandPayload,
  FatalSimulationErrorMessage,
  FatalSimulationErrorPayload,
  InitSessionMessage,
  InitSessionPayload,
  LoadSessionMessage,
  LoadSessionPayload,
  MainMessageValidationResult,
  MainToSimulationMessage,
  MainToSimulationMessageKind,
  MetricsSampleMessage,
  MetricsSamplePayload,
  PauseMessage,
  PausePayload,
  PlayerCommand,
  PlayerCommandBatchMessage,
  PlayerCommandBatchPayload,
  PlayerCommandKind,
  ProtocolEnvelope,
  ProtocolRejection,
  ReadyMessage,
  ReadyPayload,
  RenderSnapshotMessage,
  RenderSnapshotPayload,
  RequestSaveMessage,
  RequestSavePayload,
  RequestUiDetailMessage,
  RequestUiDetailPayload,
  SaveReadyMessage,
  SaveReadyPayload,
  SetSpeedMessage,
  SetSpeedPayload,
  ShutdownMessage,
  ShutdownPayload,
  SimulationProtocolReasonCode,
  SimulationToMainMessage,
  SimulationToMainMessageKind,
  UiDeltaMessage,
  UiDeltaPayload,
  UiDetailSubject,
} from "./types";

export const SIM_PROTOCOL_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-protocol",
  "package",
);

export const SIM_PROTOCOL_PUBLIC_INPUTS: readonly string[] = [CONTENT_SCHEMA_SMOKE.packageName];
