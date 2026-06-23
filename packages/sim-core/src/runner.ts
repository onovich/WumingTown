import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import { createNamedRandomStreams, restoreNamedRandomStreams } from "./deterministic-rng";
import {
  TICKS_PER_DAY,
  TICKS_PER_SECOND,
  requireSafeTick,
  type RunnerSpeed,
  type Tick,
} from "./time";
import { hashCanonicalWorld, type CanonicalCommandEntry } from "./world-hash";
import type { NamedRandomStreams, RandomStreamsSnapshot } from "./deterministic-rng";
import type { ReplayCheckpoint } from "./replay-diagnostics";

export const HEADLESS_SUMMARY_VERSION = 2;
export const HEADLESS_SNAPSHOT_VERSION = 1;

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
  readonly randomStreams: NamedRandomStreams;
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
  readonly randomStreamCount: number;
}

export interface HeadlessRunnerSnapshot {
  readonly version: number;
  readonly seed: string;
  readonly seedHash: number;
  readonly commands: readonly HeadlessQueuedCommand[];
  readonly randomStreams: RandomStreamsSnapshot;
  readonly tick: Tick;
  readonly paused: boolean;
  readonly speed: RunnerSpeed;
  readonly commandCursor: number;
  readonly nextCommandSequence: number;
  readonly appliedCommandCount: number;
  readonly commandHash: number;
  readonly worldHash: number;
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
    randomStreams: createNamedRandomStreams({ seed: options.seed }),
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
    randomStreamCount: state.randomStreams.snapshot().streams.length,
  };
}

export function serializeHeadlessRunner(state: HeadlessRunnerState): HeadlessRunnerSnapshot {
  return {
    version: HEADLESS_SNAPSHOT_VERSION,
    seed: state.seed,
    seedHash: state.seedHash,
    commands: cloneCommands(state.commands),
    randomStreams: state.randomStreams.snapshot(),
    tick: state.tick,
    paused: state.paused,
    speed: state.speed,
    commandCursor: state.commandCursor,
    nextCommandSequence: state.nextCommandSequence,
    appliedCommandCount: state.appliedCommandCount,
    commandHash: state.commandHash,
    worldHash: state.worldHash,
  };
}

export function restoreHeadlessRunner(snapshot: HeadlessRunnerSnapshot): HeadlessRunnerState {
  validateHeadlessSnapshot(snapshot);

  return {
    seed: snapshot.seed,
    seedHash: snapshot.seedHash,
    commands: cloneCommands(snapshot.commands),
    randomStreams: restoreNamedRandomStreams(snapshot.randomStreams),
    tick: snapshot.tick,
    paused: snapshot.paused,
    speed: snapshot.speed,
    commandCursor: snapshot.commandCursor,
    nextCommandSequence: snapshot.nextCommandSequence,
    appliedCommandCount: snapshot.appliedCommandCount,
    commandHash: snapshot.commandHash,
    worldHash: snapshot.worldHash,
  };
}

export function createHeadlessReplayCheckpoint(state: HeadlessRunnerState): ReplayCheckpoint {
  return {
    tick: state.tick,
    worldHash: summarizeHeadlessRun(state).worldHash,
    commandHash: formatUint32Hex(state.commandHash),
  };
}

export function runHeadlessTicks(seed: string, ticks: Tick): HeadlessRunSummary {
  const runner = createHeadlessRunner({ seed });
  advanceHeadlessTicks(runner, ticks);
  return summarizeHeadlessRun(runner);
}

function runOneTick(state: HeadlessRunnerState): void {
  applyCommandsForCurrentTick(state);
  const storyDirectorRoll = state.randomStreams.nextUint32("story-director");
  state.worldHash = mixUint32(state.worldHash, state.tick);
  state.worldHash = mixUint32(state.worldHash, storyDirectorRoll);
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
  return hashCanonicalWorld({
    fields: [
      { name: "appliedCommandCount", value: state.appliedCommandCount },
      { name: "commandCursor", value: state.commandCursor },
      { name: "commandHash", value: state.commandHash },
      { name: "nextCommandSequence", value: state.nextCommandSequence },
      { name: "rollingWorldHash", value: state.worldHash },
      { name: "seed", value: state.seed },
      { name: "seedHash", value: state.seedHash },
      { name: "tick", value: state.tick },
    ],
    randomStreams: state.randomStreams.snapshot().streams,
    queuedCommands: toCanonicalCommands(state.commands),
  });
}

function cloneCommands(commands: readonly HeadlessQueuedCommand[]): HeadlessQueuedCommand[] {
  const cloned: HeadlessQueuedCommand[] = [];

  for (const command of commands) {
    cloned.push({
      tick: command.tick,
      sequence: command.sequence,
      commandId: command.commandId,
      kind: command.kind,
      commandHash: command.commandHash,
    });
  }

  return cloned;
}

function toCanonicalCommands(commands: readonly HeadlessQueuedCommand[]): CanonicalCommandEntry[] {
  const canonical: CanonicalCommandEntry[] = [];

  for (const command of commands) {
    canonical.push({
      tick: command.tick,
      sequence: command.sequence,
      commandHash: command.commandHash,
    });
  }

  return canonical;
}

function validateHeadlessSnapshot(snapshot: HeadlessRunnerSnapshot): void {
  if (snapshot.version !== HEADLESS_SNAPSHOT_VERSION) {
    throw new Error("unsupported headless runner snapshot version");
  }

  if (snapshot.seed.length === 0 || hashStringToUint32(snapshot.seed) !== snapshot.seedHash) {
    throw new Error("headless runner snapshot seed hash mismatch");
  }

  if (
    snapshot.randomStreams.seed !== snapshot.seed ||
    snapshot.randomStreams.seedHash !== snapshot.seedHash
  ) {
    throw new Error("headless runner snapshot random stream seed mismatch");
  }

  requireSafeTick(snapshot.tick, "snapshot tick");
  requireSafeTick(snapshot.commandCursor, "snapshot command cursor");
  requireSafeTick(snapshot.nextCommandSequence, "snapshot next command sequence");
  requireSafeTick(snapshot.appliedCommandCount, "snapshot applied command count");

  if (snapshot.commandCursor > snapshot.commands.length) {
    throw new Error("snapshot command cursor exceeds queued command count");
  }
}
