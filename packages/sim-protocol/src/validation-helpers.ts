import { MAIN_TO_SIMULATION_MESSAGE_KIND, PLAYER_COMMAND_KIND } from "./constants";
import type { MainToSimulationMessageKind, PlayerCommandKind } from "./types";
import type { ProtocolInputRecord } from "./validation-types";

export function isRecord(value: unknown): value is ProtocolInputRecord {
  return typeof value === "object" && value !== null;
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

export function isMainMessageKind(value: unknown): value is MainToSimulationMessageKind {
  return (
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.Pause ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand ||
    value === MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown
  );
}

export function isPlayerCommandKind(value: unknown): value is PlayerCommandKind {
  return value === PLAYER_COMMAND_KIND.Noop || value === PLAYER_COMMAND_KIND.Echo;
}
