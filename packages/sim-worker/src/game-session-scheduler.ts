import { GAME_SESSION_SCHEDULER_QUANTUM_MS } from "./game-session-worker-host";

export type GameSessionSchedulerTimerHandle = ReturnType<typeof globalThis.setInterval>;

export const GAME_SESSION_MAX_CATCH_UP_QUANTA_PER_CALLBACK = 10;
export const GAME_SESSION_MAX_WALL_TIME_DEBT_MS = 60_000;

export interface GameSessionSchedulerTimer {
  setRepeating(callback: () => void, intervalMs: number): GameSessionSchedulerTimerHandle;
  clearRepeating(handle: GameSessionSchedulerTimerHandle): void;
  readNowMilliseconds(): number;
}

export interface GameSessionSchedulerDiagnostics {
  readonly debtMilliseconds: number;
  readonly discardedWallTimeMilliseconds: number;
  readonly dispatchedQuantumCount: number;
  readonly callbackCount: number;
}

export interface GameSessionContinuousScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  createDiagnostics(): GameSessionSchedulerDiagnostics;
}

export function createGameSessionContinuousScheduler(
  onQuanta: (quantumCount: number) => void,
  timer: GameSessionSchedulerTimer = DEFAULT_TIMER,
): GameSessionContinuousScheduler {
  let handle: GameSessionSchedulerTimerHandle | undefined;
  let lastNowMilliseconds = 0;
  let debtMilliseconds = 0;
  let discardedWallTimeMilliseconds = 0;
  let dispatchedQuantumCount = 0;
  let callbackCount = 0;

  const onInterval = (): void => {
    if (handle === undefined) return;
    callbackCount += 1;
    const observedNow = normalizeNow(timer.readNowMilliseconds(), lastNowMilliseconds);
    const elapsedMilliseconds = observedNow - lastNowMilliseconds;
    lastNowMilliseconds = observedNow;
    const nextDebt = debtMilliseconds + elapsedMilliseconds;
    if (nextDebt > GAME_SESSION_MAX_WALL_TIME_DEBT_MS) {
      discardedWallTimeMilliseconds += nextDebt - GAME_SESSION_MAX_WALL_TIME_DEBT_MS;
      debtMilliseconds = GAME_SESSION_MAX_WALL_TIME_DEBT_MS;
    } else {
      debtMilliseconds = nextDebt;
    }

    const dueQuanta = Math.floor(debtMilliseconds / GAME_SESSION_SCHEDULER_QUANTUM_MS);
    const dispatchCount = Math.min(dueQuanta, GAME_SESSION_MAX_CATCH_UP_QUANTA_PER_CALLBACK);
    if (dispatchCount === 0) return;
    debtMilliseconds -= dispatchCount * GAME_SESSION_SCHEDULER_QUANTUM_MS;
    dispatchedQuantumCount += dispatchCount;
    onQuanta(dispatchCount);
  };

  return {
    start(): void {
      if (handle !== undefined) return;
      lastNowMilliseconds = normalizeNow(timer.readNowMilliseconds(), 0);
      debtMilliseconds = 0;
      handle = timer.setRepeating(onInterval, GAME_SESSION_SCHEDULER_QUANTUM_MS);
    },
    stop(): void {
      if (handle === undefined) return;
      const activeHandle = handle;
      handle = undefined;
      debtMilliseconds = 0;
      timer.clearRepeating(activeHandle);
    },
    isRunning(): boolean {
      return handle !== undefined;
    },
    createDiagnostics(): GameSessionSchedulerDiagnostics {
      return {
        debtMilliseconds,
        discardedWallTimeMilliseconds,
        dispatchedQuantumCount,
        callbackCount,
      };
    },
  };
}

function normalizeNow(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < fallback) return fallback;
  return Math.floor(value);
}

const DEFAULT_TIMER: GameSessionSchedulerTimer = {
  setRepeating(callback: () => void, intervalMs: number): GameSessionSchedulerTimerHandle {
    return globalThis.setInterval(callback, intervalMs);
  },
  clearRepeating(handle: GameSessionSchedulerTimerHandle): void {
    globalThis.clearInterval(handle);
  },
  readNowMilliseconds(): number {
    return globalThis.performance.now();
  },
};
