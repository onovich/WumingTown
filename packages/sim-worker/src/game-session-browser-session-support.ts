import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type SaveReadyMessage,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export type BrowserSessionPostState =
  | "created"
  | "initializing"
  | "active"
  | "shutdown"
  | "fatal"
  | "destroyed";

export type ReliableSimulationWorkerMessage =
  | Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult }
    >
  | SaveReadyMessage
  | Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch }
    >
  | Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError }
    >;

export function assertCanPost(state: BrowserSessionPostState): void {
  if (state === "destroyed") {
    throw new Error("Browser Simulation Worker session has been destroyed.");
  }
  if (state === "shutdown") {
    throw new Error("Browser Simulation Worker session has already been shut down.");
  }
  if (state === "fatal") {
    throw new Error("Browser Simulation Worker session is closed after a fatal error.");
  }
  if (state === "initializing") {
    throw new Error("Browser Simulation Worker session is awaiting Ready negotiation.");
  }
}

export function assertPlayableAdvanceTargetTick(targetTick: number): void {
  if (!Number.isSafeInteger(targetTick) || targetTick < 0) {
    throw new Error("Playable Worker advance target tick must be a non-negative safe integer.");
  }
}

export function subscribe<T>(listeners: T[], listener: T): () => void {
  listeners.push(listener);
  return (): void => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

export function emitListeners<T>(listeners: readonly ((value: T) => void)[], value: T): void {
  const snapshot = [...listeners];
  for (const listener of snapshot) listener(value);
}

export function isSimulationToMainMessage(value: unknown): value is SimulationToMainMessage {
  if (!isRecord(value) || !isRecord(value["payload"])) return false;
  const kind = value["kind"];
  if (kind === SIMULATION_TO_MAIN_MESSAGE_KIND.Ready && value["payload"]["status"] !== "ready") {
    return false;
  }
  return (
    value["protocolVersion"] === SIM_PROTOCOL_VERSION &&
    value["schemaVersion"] === SIM_SCHEMA_VERSION &&
    typeof value["sessionId"] === "string" &&
    Number.isSafeInteger(value["sequence"]) &&
    typeof value["sequence"] === "number" &&
    value["sequence"] > 0 &&
    isSimulationMessageKind(kind)
  );
}

export function isReliableSimulationWorkerMessage(
  message: SimulationToMainMessage,
): message is ReliableSimulationWorkerMessage {
  return (
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult ||
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady ||
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch ||
    message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError
  );
}

function isSimulationMessageKind(kind: unknown): boolean {
  return (
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.Ready ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample ||
    kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
