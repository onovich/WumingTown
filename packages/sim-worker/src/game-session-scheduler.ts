import { GAME_SESSION_SCHEDULER_QUANTUM_MS } from "./game-session-worker-host";

export type GameSessionSchedulerTimerHandle = ReturnType<typeof globalThis.setInterval>;

export interface GameSessionSchedulerTimer {
  setRepeating(callback: () => void, intervalMs: number): GameSessionSchedulerTimerHandle;
  clearRepeating(handle: GameSessionSchedulerTimerHandle): void;
}

export interface GameSessionContinuousScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export function createGameSessionContinuousScheduler(
  onQuantum: () => void,
  timer: GameSessionSchedulerTimer = DEFAULT_TIMER,
): GameSessionContinuousScheduler {
  let handle: GameSessionSchedulerTimerHandle | undefined;
  return {
    start(): void {
      if (handle !== undefined) return;
      handle = timer.setRepeating(onQuantum, GAME_SESSION_SCHEDULER_QUANTUM_MS);
    },
    stop(): void {
      if (handle === undefined) return;
      timer.clearRepeating(handle);
      handle = undefined;
    },
    isRunning(): boolean {
      return handle !== undefined;
    },
  };
}

const DEFAULT_TIMER: GameSessionSchedulerTimer = {
  setRepeating(callback: () => void, intervalMs: number): GameSessionSchedulerTimerHandle {
    return globalThis.setInterval(callback, intervalMs);
  },
  clearRepeating(handle: GameSessionSchedulerTimerHandle): void {
    globalThis.clearInterval(handle);
  },
};
