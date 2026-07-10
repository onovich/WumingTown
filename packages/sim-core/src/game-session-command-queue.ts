import { hashStringToUint32, mixUint32 } from "./deterministic-hash";
import type { CanonicalCommandEntry } from "./world-hash";
import {
  type GameSessionCommandInput,
  type GameSessionQueueCommandResult,
  type GameSessionQueuedCommand,
} from "./game-session-types";
import type { Tick } from "./time";

export class GameSessionCommandQueue {
  readonly capacity: number;

  private readonly ticks: Float64Array;
  private readonly sequences: Uint32Array;
  private readonly hashes: Uint32Array;
  private readonly commandIds: (string | undefined)[];
  private count = 0;
  private cursor = 0;
  private nextSequence = 0;
  private appliedTotal = 0;
  private backlogPeakValue = 0;
  private rollingHashValue: number;

  constructor(capacity: number, seedHash: number) {
    this.capacity = capacity;
    this.ticks = new Float64Array(capacity);
    this.sequences = new Uint32Array(capacity);
    this.hashes = new Uint32Array(capacity);
    this.commandIds = new Array<string | undefined>(capacity);
    this.rollingHashValue = seedHash;
  }

  get queuedCount(): number {
    return this.count;
  }

  get pendingCount(): number {
    return this.count - this.cursor;
  }

  get appliedCount(): number {
    return this.appliedTotal;
  }

  get backlogPeak(): number {
    return this.backlogPeakValue;
  }

  get rollingHash(): number {
    return this.rollingHashValue;
  }

  get nextPendingTick(): Tick | undefined {
    return this.cursor < this.count ? this.ticks[this.cursor] : undefined;
  }

  queue(input: GameSessionCommandInput, currentTick: Tick): GameSessionQueueCommandResult {
    if (!Number.isSafeInteger(input.tick) || input.tick < currentTick) {
      return { ok: false, reason: "game_session.command_tick_invalid" };
    }

    if (input.commandId.length === 0) {
      return { ok: false, reason: "game_session.command_id_invalid" };
    }

    if (this.count >= this.capacity) {
      return { ok: false, reason: "game_session.command_queue_full" };
    }

    const previousTick = this.count > 0 ? (this.ticks[this.count - 1] ?? 0) : currentTick;
    if (input.tick < previousTick) {
      return { ok: false, reason: "game_session.command_order_invalid" };
    }

    const sequence = this.nextSequence;
    const commandHash = hashCommand(input, sequence);
    this.ticks[this.count] = input.tick;
    this.sequences[this.count] = sequence;
    this.hashes[this.count] = commandHash;
    this.commandIds[this.count] = input.commandId;
    this.count += 1;
    this.nextSequence += 1;
    const pending = this.pendingCount;
    if (pending > this.backlogPeakValue) {
      this.backlogPeakValue = pending;
    }

    return {
      ok: true,
      command: { ...input, sequence, commandHash },
    };
  }

  applyForTick(tick: Tick): number {
    let applied = 0;

    while (this.cursor < this.count && (this.ticks[this.cursor] ?? -1) === tick) {
      const commandHash = this.hashes[this.cursor] ?? 0;
      const sequence = this.sequences[this.cursor] ?? 0;
      this.rollingHashValue = mixUint32(this.rollingHashValue, commandHash);
      this.rollingHashValue = mixUint32(this.rollingHashValue, sequence);
      this.cursor += 1;
      this.appliedTotal += 1;
      applied += 1;
    }

    return applied;
  }

  createCanonicalEntries(): CanonicalCommandEntry[] {
    const entries: CanonicalCommandEntry[] = [];

    for (let index = 0; index < this.count; index += 1) {
      entries.push({
        tick: this.ticks[index] ?? 0,
        sequence: this.sequences[index] ?? 0,
        commandHash: this.hashes[index] ?? 0,
      });
    }

    return entries;
  }

  read(index: number): GameSessionQueuedCommand | undefined {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.count) {
      return undefined;
    }

    const commandId = this.commandIds[index];
    if (commandId === undefined) {
      return undefined;
    }

    return {
      tick: this.ticks[index] ?? 0,
      sequence: this.sequences[index] ?? 0,
      commandId,
      kind: "noop",
      commandHash: this.hashes[index] ?? 0,
    };
  }
}

function hashCommand(input: GameSessionCommandInput, sequence: number): number {
  let hash = hashStringToUint32(input.commandId);
  hash = mixUint32(hash, input.tick);
  hash = mixUint32(hash, sequence);
  return mixUint32(hash, hashStringToUint32(input.kind));
}
