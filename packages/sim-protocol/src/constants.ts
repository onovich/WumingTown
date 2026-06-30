export const SIM_PROTOCOL_VERSION = 1;
export const SIM_SCHEMA_VERSION = 2;
export const PLAYABLE_COMMAND_CONTRACT_VERSION = 1;
export const PLAYABLE_COMMAND_READ_MODEL_VERSION = 1;

export const MAIN_TO_SIMULATION_MESSAGE_KIND = {
  InitSession: "InitSession",
  LoadSession: "LoadSession",
  PlayerCommandBatch: "PlayerCommandBatch",
  SetSpeed: "SetSpeed",
  Pause: "Pause",
  RequestUiDetail: "RequestUiDetail",
  RequestSave: "RequestSave",
  DevCommand: "DevCommand",
  Shutdown: "Shutdown",
} as const;

export const SIMULATION_TO_MAIN_MESSAGE_KIND = {
  Ready: "Ready",
  RenderSnapshot: "RenderSnapshot",
  UiDelta: "UiDelta",
  CommandResult: "CommandResult",
  AlertBatch: "AlertBatch",
  SaveReady: "SaveReady",
  MetricsSample: "MetricsSample",
  FatalSimulationError: "FatalSimulationError",
} as const;

export const SIMULATION_PROTOCOL_REASON_CODE = {
  UnsupportedProtocolVersion: "UnsupportedProtocolVersion",
  UnsupportedSchemaVersion: "UnsupportedSchemaVersion",
  UnknownMessageKind: "UnknownMessageKind",
  UnknownCommandKind: "UnknownCommandKind",
  StaleSequence: "StaleSequence",
  StaleSession: "StaleSession",
  InvalidPayload: "InvalidPayload",
  LifecycleError: "LifecycleError",
} as const;

export const PLAYER_COMMAND_KIND = {
  Noop: "Noop",
  Echo: "Echo",
  PrioritizeLampWork: "PrioritizeLampWork",
  QueueSimpleBuild: "QueueSimpleBuild",
} as const;

export const COMMAND_BLOCKED_REASON_CODE = {
  MissingResource: "missing_resource",
  NoPath: "no_path",
  NoWorker: "no_worker",
  InvalidTarget: "invalid_target",
  StaleCommand: "stale_command",
  RulePolicyDenial: "rule_policy_denial",
} as const;
