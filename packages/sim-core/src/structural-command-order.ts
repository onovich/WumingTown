import { commandPriority, isCommandCode } from "./structural-command-types";

const BYTE_BUCKET_COUNT = 256;
const PRIORITY_BUCKET_COUNT = 5;
const SIGNED_INDEX_BIAS = -2_147_483_648;

export class StructuralCommandOrder {
  private readonly orderedSlots: Uint32Array;
  private readonly scratchSlots: Uint32Array;
  private readonly bucketOffsets: Uint32Array;

  constructor(capacity: number) {
    this.orderedSlots = new Uint32Array(capacity);
    this.scratchSlots = new Uint32Array(capacity);
    this.bucketOffsets = new Uint32Array(BYTE_BUCKET_COUNT);
  }

  order(
    count: number,
    kinds: Uint8Array,
    indexes: Int32Array,
    sequences: Uint32Array,
  ): Uint32Array {
    for (let slot = 0; slot < count; slot += 1) {
      this.orderedSlots[slot] = slot;
    }

    let source = this.orderedSlots;
    let target = this.scratchSlots;

    for (let byte = 0; byte < 4; byte += 1) {
      this.countSequenceByte(source, target, count, sequences, byte * 8);
      const previousSource = source;
      source = target;
      target = previousSource;
    }

    for (let byte = 0; byte < 4; byte += 1) {
      this.countSignedIndexByte(source, target, count, indexes, byte * 8);
      const previousSource = source;
      source = target;
      target = previousSource;
    }

    this.countPriority(source, target, count, kinds);
    return target;
  }

  private countSequenceByte(
    source: Uint32Array,
    target: Uint32Array,
    count: number,
    sequences: Uint32Array,
    shift: number,
  ): void {
    this.bucketOffsets.fill(0);

    for (let cursor = 0; cursor < count; cursor += 1) {
      const slot = source[cursor] ?? 0;
      const bucket = ((sequences[slot] ?? 0) >>> shift) & 0xff;
      this.bucketOffsets[bucket] = (this.bucketOffsets[bucket] ?? 0) + 1;
    }

    this.convertCountsToOffsets(BYTE_BUCKET_COUNT);

    for (let cursor = 0; cursor < count; cursor += 1) {
      const slot = source[cursor] ?? 0;
      const bucket = ((sequences[slot] ?? 0) >>> shift) & 0xff;
      const offset = this.bucketOffsets[bucket] ?? 0;
      target[offset] = slot;
      this.bucketOffsets[bucket] = offset + 1;
    }
  }

  private countSignedIndexByte(
    source: Uint32Array,
    target: Uint32Array,
    count: number,
    indexes: Int32Array,
    shift: number,
  ): void {
    this.bucketOffsets.fill(0);

    for (let cursor = 0; cursor < count; cursor += 1) {
      const slot = source[cursor] ?? 0;
      const bucket = (((indexes[slot] ?? 0) ^ SIGNED_INDEX_BIAS) >>> shift) & 0xff;
      this.bucketOffsets[bucket] = (this.bucketOffsets[bucket] ?? 0) + 1;
    }

    this.convertCountsToOffsets(BYTE_BUCKET_COUNT);

    for (let cursor = 0; cursor < count; cursor += 1) {
      const slot = source[cursor] ?? 0;
      const bucket = (((indexes[slot] ?? 0) ^ SIGNED_INDEX_BIAS) >>> shift) & 0xff;
      const offset = this.bucketOffsets[bucket] ?? 0;
      target[offset] = slot;
      this.bucketOffsets[bucket] = offset + 1;
    }
  }

  private countPriority(
    source: Uint32Array,
    target: Uint32Array,
    count: number,
    kinds: Uint8Array,
  ): void {
    this.bucketOffsets.fill(0, 0, PRIORITY_BUCKET_COUNT);

    for (let cursor = 0; cursor < count; cursor += 1) {
      const slot = source[cursor] ?? 0;
      const priority = readPriority(kinds[slot]);
      this.bucketOffsets[priority] = (this.bucketOffsets[priority] ?? 0) + 1;
    }

    this.convertCountsToOffsets(PRIORITY_BUCKET_COUNT);

    for (let cursor = 0; cursor < count; cursor += 1) {
      const slot = source[cursor] ?? 0;
      const priority = readPriority(kinds[slot]);
      const offset = this.bucketOffsets[priority] ?? 0;
      target[offset] = slot;
      this.bucketOffsets[priority] = offset + 1;
    }
  }

  private convertCountsToOffsets(bucketCount: number): void {
    let offset = 0;

    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const count = this.bucketOffsets[bucket] ?? 0;
      this.bucketOffsets[bucket] = offset;
      offset += count;
    }
  }
}

function readPriority(kind: number | undefined): number {
  if (isCommandCode(kind)) {
    return commandPriority(kind);
  }

  throw new Error("unknown structural command kind");
}
