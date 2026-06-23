export const TICKS_PER_SECOND = 30;
export const TICKS_PER_DAY = 36_000;

export type Tick = number;
export type RunnerSpeed = 0 | 1 | 2 | 3;

export function isSafeTick(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function requireSafeTick(value: number, label: string): Tick {
  if (!isSafeTick(value)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }

  return value;
}
