import { hashStringToUint32, mixUint32 } from "./deterministic-hash";

export const RANDOM_STREAMS_SNAPSHOT_VERSION = 1;

export interface NamedRandomStreamsOptions {
  readonly seed: string;
}

export interface RandomStreamSnapshot {
  readonly name: string;
  readonly state: number;
  readonly draws: number;
}

export interface RandomStreamsSnapshot {
  readonly version: number;
  readonly seed: string;
  readonly seedHash: number;
  readonly streams: readonly RandomStreamSnapshot[];
}

interface MutableRandomStream {
  readonly name: string;
  state: number;
  draws: number;
}

export class NamedRandomStreams {
  readonly seed: string;
  readonly seedHash: number;

  private readonly streams: MutableRandomStream[] = [];

  constructor(options: NamedRandomStreamsOptions) {
    if (options.seed.length === 0) {
      throw new Error("random seed must be a non-empty string");
    }

    this.seed = options.seed;
    this.seedHash = hashStringToUint32(options.seed);
  }

  nextUint32(streamName: string): number {
    const stream = this.requireStream(streamName);
    stream.state = nextXorShift32(stream.state);
    stream.draws += 1;
    return stream.state;
  }

  nextInt(streamName: string, exclusiveMax: number): number {
    if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax <= 0) {
      throw new Error("exclusiveMax must be a positive safe integer");
    }

    return this.nextUint32(streamName) % exclusiveMax;
  }

  snapshot(): RandomStreamsSnapshot {
    const streams: RandomStreamSnapshot[] = [];

    for (const stream of this.streams) {
      streams.push({
        name: stream.name,
        state: stream.state,
        draws: stream.draws,
      });
    }

    return {
      version: RANDOM_STREAMS_SNAPSHOT_VERSION,
      seed: this.seed,
      seedHash: this.seedHash,
      streams,
    };
  }

  restore(snapshot: RandomStreamsSnapshot): void {
    validateSnapshotHeader(snapshot, this.seed, this.seedHash);
    this.streams.length = 0;

    let previousName = "";
    let index = 0;
    for (const stream of snapshot.streams) {
      validateStreamSnapshot(stream);

      if (index > 0 && stream.name <= previousName) {
        throw new Error("random stream snapshots must be sorted by unique stream name");
      }

      this.streams.push({
        name: stream.name,
        state: stream.state,
        draws: stream.draws,
      });
      previousName = stream.name;
      index += 1;
    }
  }

  private requireStream(streamName: string): MutableRandomStream {
    validateStreamName(streamName);

    const existingIndex = this.findStreamIndex(streamName);
    if (existingIndex >= 0) {
      const existing = this.streams[existingIndex];

      if (existing !== undefined) {
        return existing;
      }
    }

    const stream: MutableRandomStream = {
      name: streamName,
      state: deriveInitialState(this.seedHash, streamName),
      draws: 0,
    };
    const insertIndex = this.findInsertIndex(streamName);
    this.streams.splice(insertIndex, 0, stream);
    return stream;
  }

  private findStreamIndex(streamName: string): number {
    for (let index = 0; index < this.streams.length; index += 1) {
      const stream = this.streams[index];

      if (stream?.name === streamName) {
        return index;
      }

      if (stream !== undefined && stream.name > streamName) {
        return -1;
      }
    }

    return -1;
  }

  private findInsertIndex(streamName: string): number {
    for (let index = 0; index < this.streams.length; index += 1) {
      const stream = this.streams[index];

      if (stream !== undefined && stream.name > streamName) {
        return index;
      }
    }

    return this.streams.length;
  }
}

export function createNamedRandomStreams(options: NamedRandomStreamsOptions): NamedRandomStreams {
  return new NamedRandomStreams(options);
}

export function restoreNamedRandomStreams(snapshot: RandomStreamsSnapshot): NamedRandomStreams {
  const streams = new NamedRandomStreams({ seed: snapshot.seed });
  streams.restore(snapshot);
  return streams;
}

function validateSnapshotHeader(
  snapshot: RandomStreamsSnapshot,
  expectedSeed: string,
  expectedSeedHash: number,
): void {
  if (snapshot.version !== RANDOM_STREAMS_SNAPSHOT_VERSION) {
    throw new Error("unsupported random streams snapshot version");
  }

  if (snapshot.seed !== expectedSeed || snapshot.seedHash !== expectedSeedHash) {
    throw new Error("random streams snapshot seed does not match target registry");
  }
}

function validateStreamSnapshot(snapshot: RandomStreamSnapshot): void {
  validateStreamName(snapshot.name);

  if (!isUint32(snapshot.state)) {
    throw new Error("random stream state must be an unsigned 32-bit integer");
  }

  if (snapshot.state === 0) {
    throw new Error("random stream state must not be zero");
  }

  if (!Number.isSafeInteger(snapshot.draws) || snapshot.draws < 0) {
    throw new Error("random stream draws must be a non-negative safe integer");
  }
}

function validateStreamName(streamName: string): void {
  if (streamName.length === 0) {
    throw new Error("random stream name must be a non-empty string");
  }
}

function deriveInitialState(seedHash: number, streamName: string): number {
  let state = mixUint32(seedHash, hashStringToUint32(streamName));
  state = mixUint32(state, 0x9e37_79b9);

  if (state === 0) {
    return 0x6d2b_79f5;
  }

  return state;
}

function nextXorShift32(state: number): number {
  let value = state >>> 0;
  value ^= value << 13;
  value >>>= 0;
  value ^= value >>> 17;
  value >>>= 0;
  value ^= value << 5;
  return value >>> 0;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}
