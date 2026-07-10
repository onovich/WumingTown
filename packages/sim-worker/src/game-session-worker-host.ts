import {
  PR1_INTEGRATED_GAME_SESSION_ALIAS,
  PR1_INTEGRATED_GAME_SESSION_ID,
  initializeGameSessionRuntime,
  type GameSessionRuntime,
} from "@wuming-town/sim-core";
import {
  GAME_SESSION_PROJECTION_VERSION,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  type GameSessionAlertV1,
  type GameSessionProjectionContractV1,
  type GameSessionRenderProjectionV1,
  type GameSessionUiProjectionV1,
  type PlayerCommand,
  type ProtocolRejection,
  type UiDetailSubject,
} from "@wuming-town/sim-protocol";

import { createGameSessionProjectionPair } from "./game-session-projection-mapper";

export const GAME_SESSION_SCHEDULER_QUANTUM_MS = 100;
export const GAME_SESSION_TICKS_PER_QUANTUM_AT_SPEED_1 = 3;

export interface GameSessionWorkerPublication {
  readonly render: GameSessionRenderProjectionV1;
  readonly ui: GameSessionUiProjectionV1;
  readonly changedAlerts: readonly GameSessionAlertV1[];
}

export type GameSessionWorkerHostInitializationResult =
  | { readonly ok: true; readonly host: GameSessionWorkerHost }
  | { readonly ok: false; readonly reason: ProtocolRejection };

export type GameSessionCommandBatchResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ProtocolRejection };

export class GameSessionWorkerHost {
  readonly runtime: GameSessionRuntime;
  readonly projectionContract: GameSessionProjectionContractV1 = {
    kind: "game_session",
    version: GAME_SESSION_PROJECTION_VERSION,
  };

  private snapshotSequence = 0;
  private previousSnapshotSequence: number | null = null;
  private requestedSpeedValue: 0 | 1 | 2 | 3 = 1;
  private pausedValue = false;
  private selection: UiDetailSubject | null = null;
  private lastAlertSignature = "";

  private constructor(runtime: GameSessionRuntime) {
    this.runtime = runtime;
  }

  static initialize(seed: string): GameSessionWorkerHostInitializationResult {
    const initialized = initializeGameSessionRuntime({ seed });
    if (!initialized.ok) {
      return {
        ok: false,
        reason: {
          code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
          detail: `GameSession initialization failed: ${initialized.reason}:${String(initialized.stageIndex)}`,
        },
      };
    }
    return { ok: true, host: new GameSessionWorkerHost(initialized.runtime) };
  }

  static isCatalogVersion(catalogVersion: string): boolean {
    return (
      catalogVersion === PR1_INTEGRATED_GAME_SESSION_ID ||
      catalogVersion === PR1_INTEGRATED_GAME_SESSION_ALIAS
    );
  }

  get tick(): number {
    return this.runtime.tick;
  }

  get requestedSpeed(): 0 | 1 | 2 | 3 {
    return this.requestedSpeedValue;
  }

  get paused(): boolean {
    return this.pausedValue;
  }

  get effectiveTicksPerSecond(): 0 | 30 | 60 | 90 {
    if (this.pausedValue || this.requestedSpeedValue === 0) return 0;
    if (this.requestedSpeedValue === 1) return 30;
    if (this.requestedSpeedValue === 2) return 60;
    return 90;
  }

  setSpeed(speed: 0 | 1 | 2 | 3): void {
    this.requestedSpeedValue = speed;
    this.runtime.setRequestedSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.pausedValue = paused;
    this.runtime.setPaused(paused);
  }

  setSelection(subject: UiDetailSubject): void {
    this.selection = subject;
  }

  queueCommands(commands: readonly PlayerCommand[]): GameSessionCommandBatchResult {
    for (const command of commands) {
      if (command.kind !== PLAYER_COMMAND_KIND.Noop && command.kind !== PLAYER_COMMAND_KIND.Echo) {
        return {
          ok: false,
          reason: {
            code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
            detail: "GameSession PR-1 accepts deterministic Noop/Echo commands only",
          },
        };
      }
      const queued = this.runtime.queueCommand({
        tick: this.runtime.tick,
        commandId: command.commandId,
        kind: "noop",
      });
      if (!queued.ok) {
        return {
          ok: false,
          reason: {
            code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
            detail: `GameSession command rejected: ${queued.reason}`,
          },
        };
      }
    }
    return { ok: true };
  }

  advanceScheduledQuantum(): number {
    if (this.effectiveTicksPerSecond === 0) return 0;
    return this.advanceTicks(GAME_SESSION_TICKS_PER_QUANTUM_AT_SPEED_1 * this.requestedSpeedValue);
  }

  advanceTicks(ticks: number): number {
    return this.runtime.advanceTicks(ticks).advancedTicks;
  }

  createPublication(): GameSessionWorkerPublication {
    const nextSequence = this.snapshotSequence + 1;
    const pair = createGameSessionProjectionPair({
      runtime: this.runtime,
      snapshotSequence: nextSequence,
      previousSnapshotSequence: this.previousSnapshotSequence,
      effectiveTicksPerSecond: this.effectiveTicksPerSecond,
      selection: this.selection,
    });
    this.previousSnapshotSequence = nextSequence;
    this.snapshotSequence = nextSequence;
    const signature = createAlertSignature(pair.ui.alerts);
    const changedAlerts = signature === this.lastAlertSignature ? [] : pair.ui.alerts;
    this.lastAlertSignature = signature;
    return { render: pair.render, ui: pair.ui, changedAlerts };
  }
}

function createAlertSignature(alerts: readonly GameSessionAlertV1[]): string {
  let signature = "";
  for (const alert of alerts) {
    signature += `${alert.alertId}|${alert.severity}|${alert.reason.code}|${alert.reason.source}`;
    for (const parameter of alert.reason.parameters) signature += `|${String(parameter)}`;
    signature += ";";
  }
  return signature;
}
