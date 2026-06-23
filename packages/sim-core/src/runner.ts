import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import {
  TICKS_PER_DAY,
  TICKS_PER_SECOND,
  requireSafeTick,
  type RunnerSpeed,
  type Tick,
} from "./time";

export const HEADLESS_SUMMARY_VERSION = 1;

export interface HeadlessRunnerOptions {
  readonly seed: string;
}

export interface HeadlessCommandInput {
  readonly tick: Tick;
  readonly commandId: string;
  readonly kind: "noop";
}

export interface HeadlessQueuedCommand {
  readonly tick: Tick;
  readonly sequence: number;
  readonly commandId: string;
  readonly kind: "noop";
  readonly commandHash: number;
}

export interface HeadlessRunnerState {
  readonly seed: string;
  readonly seedHash: number;
  readonly commands: HeadlessQueuedCommand[];
  tick: Tick;
  paused: boolean;
  speed: RunnerSpeed;
  commandCursor: number;
  nextCommandSequence: number;
  appliedCommandCount: number;
  commandHash: number;
  worldHash: number;
}

export interface HeadlessRunSummary {
  readonly version: typeof HEADLESS_SUMMARY_VERSION;
  readonly ticksPerSecond: typeof TICKS_PER_SECOND;
  readonly ticksPerDay: typeof TICKS_PER_DAY;
  readonly seed: string;
  readonly seedHash: string;
  readonly finalTick: Tick;
  readonly paused: boolean;
  readonly speed: RunnerSpeed;
  readonly queuedCommandCount: number;
  readonly appliedCommandCount: number;
  readonly commandHash: string;
  readonly worldHash: string;
}

export type QueueCommandResult =
  | {
      readonly ok: true;
      readonly command: HeadlessQueuedCommand;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export function createHeadlessRunner(options: HeadlessRunnerOptions): HeadlessRunnerState {
  if (options.seed.length === 0) {
    throw new Error("seed must be a non-empty string");
  }

  const seedHash = hashStringToUint32(options.seed);

  return {
    seed: options.seed,
    seedHash,
    commands: [],
    tick: 0,
    paused: false,
    speed: 1,
    commandCursor: 0,
    nextCommandSequence: 0,
    appliedCommandCount: 0,
    commandHash: seedHash,
    worldHash: mixUint32(seedHash, TICKS_PER_SECOND),
  };
}

export function queueHeadlessCommand(
  state: HeadlessRunnerState,
  input: HeadlessCommandInput,
): QueueCommandResult {
  if (!Number.isSafeInteger(input.tick) || input.tick < state.tick) {
    return {
      ok: false,
      reason: "command tick must be a safe integer at or after the current tick",
    };
  }

  if (input.commandId.length === 0) {
    return {
      ok: false,
      reason: "commandId must be a non-empty string",
    };
  }

  const lastCommand = state.commands[state.commands.length - 1];
  if (lastCommand !== undefined && input.tick < lastCommand.tick) {
    return {
      ok: false,
      reason: "commands must be queued in non-decreasing tick order",
    };
  }

  const command: HeadlessQueuedCommand = {
    tick: input.tick,
    sequence: state.nextCommandSequence,
    commandId: input.commandId,
    kind: input.kind,
    commandHash: hashCommand(input, state.nextCommandSequence),
  };

  state.nextCommandSequence += 1;
  state.commands.push(command);

  return {
    ok: true,
    command,
  };
}

export function setHeadlessPaused(state: HeadlessRunnerState, paused: boolean): void {
  state.paused = paused;
}

export function setHeadlessSpeed(state: HeadlessRunnerState, speed: RunnerSpeed): void {
  state.speed = speed;
}

export function advanceHeadlessTicks(state: HeadlessRunnerState, requestedTicks: Tick): Tick {
  requireSafeTick(requestedTicks, "requestedTicks");

  if (state.paused || requestedTicks === 0) {
    return 0;
  }

  let advancedTicks = 0;

  while (advancedTicks < requestedTicks) {
    runOneTick(state);
    advancedTicks += 1;
  }

  return advancedTicks;
}

export function stepHeadlessFrames(state: HeadlessRunnerState, frameCount: Tick): Tick {
  requireSafeTick(frameCount, "frameCount");

  if (state.paused || state.speed === 0 || frameCount === 0) {
    return 0;
  }

  const requestedTicks = frameCount * state.speed;
  requireSafeTick(requestedTicks, "requested step ticks");
  return advanceHeadlessTicks(state, requestedTicks);
}

export function summarizeHeadlessRun(state: HeadlessRunnerState): HeadlessRunSummary {
  return {
    version: HEADLESS_SUMMARY_VERSION,
    ticksPerSecond: TICKS_PER_SECOND,
    ticksPerDay: TICKS_PER_DAY,
    seed: state.seed,
    seedHash: formatUint32Hex(state.seedHash),
    finalTick: state.tick,
    paused: state.paused,
    speed: state.speed,
    queuedCommandCount: state.commands.length,
    appliedCommandCount: state.appliedCommandCount,
    commandHash: formatUint32Hex(state.commandHash),
    worldHash: formatUint32Hex(finalWorldHash(state)),
  };
}

export function runHeadlessTicks(seed: string, ticks: Tick): HeadlessRunSummary {
  const runner = createHeadlessRunner({ seed });
  advanceHeadlessTicks(runner, ticks);
  return summarizeHeadlessRun(runner);
}

function runOneTick(state: HeadlessRunnerState): void {
  applyCommandsForCurrentTick(state);
  state.worldHash = mixUint32(state.worldHash, state.tick);
  state.tick += 1;
}

function applyCommandsForCurrentTick(state: HeadlessRunnerState): void {
  while (state.commandCursor < state.commands.length) {
    const command = state.commands[state.commandCursor];

    if (command?.tick !== state.tick) {
      return;
    }

    state.commandHash = mixUint32(state.commandHash, command.commandHash);
    state.commandHash = mixUint32(state.commandHash, command.sequence);
    state.appliedCommandCount += 1;
    state.commandCursor += 1;
  }
}

function hashCommand(command: HeadlessCommandInput, sequence: number): number {
  let hash = hashStringToUint32(command.commandId);
  hash = mixUint32(hash, command.tick);
  hash = mixUint32(hash, sequence);
  hash = mixUint32(hash, hashStringToUint32(command.kind));
  return hash;
}

function finalWorldHash(state: HeadlessRunnerState): number {
  let hash = mixUint32(state.worldHash, state.seedHash);
  hash = mixUint32(hash, state.tick);
  hash = mixUint32(hash, state.appliedCommandCount);
  hash = mixUint32(hash, state.commandHash);
  return hash;
}
