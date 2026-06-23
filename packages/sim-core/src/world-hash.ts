import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import type { RandomStreamSnapshot } from "./deterministic-rng";
import type { Tick } from "./time";

export const CANONICAL_WORLD_HASH_VERSION = 1;

export interface CanonicalWorldField {
  readonly name: string;
  readonly value: number | string | boolean;
}

export interface CanonicalCommandEntry {
  readonly tick: Tick;
  readonly sequence: number;
  readonly commandHash: number;
}

export interface CanonicalWorldHashInput {
  readonly fields: readonly CanonicalWorldField[];
  readonly randomStreams: readonly RandomStreamSnapshot[];
  readonly queuedCommands: readonly CanonicalCommandEntry[];
  readonly presentation?: unknown;
}

export function hashCanonicalWorld(input: CanonicalWorldHashInput): number {
  let hash = hashStringToUint32("wuming-town:canonical-world:v1");
  const fields = sortFieldsByName(input.fields);
  const streams = sortStreamsByName(input.randomStreams);
  const commands = sortCommandsByStableKey(input.queuedCommands);

  hash = mixUint32(hash, CANONICAL_WORLD_HASH_VERSION);
  hash = mixUint32(hash, fields.length);
  for (const field of fields) {
    hash = mixField(hash, field);
  }

  hash = mixUint32(hash, streams.length);
  for (const stream of streams) {
    hash = mixString(hash, stream.name);
    hash = mixSafeInteger(hash, stream.state);
    hash = mixSafeInteger(hash, stream.draws);
  }

  hash = mixUint32(hash, commands.length);
  for (const command of commands) {
    hash = mixSafeInteger(hash, command.tick);
    hash = mixSafeInteger(hash, command.sequence);
    hash = mixSafeInteger(hash, command.commandHash);
  }

  return hash;
}

export function formatCanonicalWorldHash(input: CanonicalWorldHashInput): string {
  return formatUint32Hex(hashCanonicalWorld(input));
}

function mixField(hash: number, field: CanonicalWorldField): number {
  let nextHash = mixString(hash, field.name);

  if (typeof field.value === "string") {
    nextHash = mixString(nextHash, "string");
    return mixString(nextHash, field.value);
  }

  if (typeof field.value === "boolean") {
    nextHash = mixString(nextHash, "boolean");
    return mixUint32(nextHash, field.value ? 1 : 0);
  }

  nextHash = mixString(nextHash, "integer");
  return mixSafeInteger(nextHash, field.value);
}

function mixString(hash: number, value: string): number {
  let nextHash = mixUint32(hash, value.length);

  for (let index = 0; index < value.length; index += 1) {
    nextHash = mixUint32(nextHash, value.charCodeAt(index));
  }

  return nextHash;
}

function mixSafeInteger(hash: number, value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error("canonical world hash only accepts safe integer numeric fields");
  }

  let nextHash = mixUint32(hash, value < 0 ? 1 : 0);
  const magnitude = Math.abs(value);
  const low = magnitude >>> 0;
  const high = Math.floor(magnitude / 0x1_0000_0000) >>> 0;
  nextHash = mixUint32(nextHash, low);
  return mixUint32(nextHash, high);
}

function sortFieldsByName(fields: readonly CanonicalWorldField[]): CanonicalWorldField[] {
  const sorted: CanonicalWorldField[] = [];

  for (const field of fields) {
    sorted.splice(findFieldInsertIndex(sorted, field), 0, field);
  }

  return sorted;
}

function findFieldInsertIndex(
  fields: readonly CanonicalWorldField[],
  field: CanonicalWorldField,
): number {
  for (let index = 0; index < fields.length; index += 1) {
    const existing = fields[index];
    const existingName = existing?.name;

    if (existingName === field.name) {
      throw new Error("canonical world hash field names must be unique");
    }

    if (existingName !== undefined && existingName > field.name) {
      return index;
    }
  }

  return fields.length;
}

function sortStreamsByName(streams: readonly RandomStreamSnapshot[]): RandomStreamSnapshot[] {
  const sorted: RandomStreamSnapshot[] = [];

  for (const stream of streams) {
    sorted.splice(findStreamInsertIndex(sorted, stream), 0, stream);
  }

  return sorted;
}

function findStreamInsertIndex(
  streams: readonly RandomStreamSnapshot[],
  stream: RandomStreamSnapshot,
): number {
  for (let index = 0; index < streams.length; index += 1) {
    const existing = streams[index];
    const existingName = existing?.name;

    if (existingName === stream.name) {
      throw new Error("canonical world hash random stream names must be unique");
    }

    if (existingName !== undefined && existingName > stream.name) {
      return index;
    }
  }

  return streams.length;
}

function sortCommandsByStableKey(
  commands: readonly CanonicalCommandEntry[],
): CanonicalCommandEntry[] {
  const sorted: CanonicalCommandEntry[] = [];

  for (const command of commands) {
    sorted.splice(findCommandInsertIndex(sorted, command), 0, command);
  }

  return sorted;
}

function findCommandInsertIndex(
  commands: readonly CanonicalCommandEntry[],
  command: CanonicalCommandEntry,
): number {
  for (let index = 0; index < commands.length; index += 1) {
    const existing = commands[index];

    if (existing !== undefined && compareCommand(command, existing) < 0) {
      return index;
    }
  }

  return commands.length;
}

function compareCommand(left: CanonicalCommandEntry, right: CanonicalCommandEntry): number {
  if (left.tick !== right.tick) {
    return left.tick - right.tick;
  }

  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  return left.commandHash - right.commandHash;
}
