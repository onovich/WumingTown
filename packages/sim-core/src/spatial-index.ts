import { assertValidCapacity } from "./entity-id";

export type SpatialIndexReason =
  | "spatial_entity_index_out_of_range"
  | "spatial_cell_out_of_range"
  | "spatial_chunk_out_of_range"
  | "spatial_region_out_of_range"
  | "spatial_entity_already_indexed"
  | "spatial_entity_not_indexed";

export type SpatialIndexMutationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: SpatialIndexReason;
    };

export type SpatialIndexQueryResult =
  | {
      readonly ok: true;
      readonly count: number;
      readonly totalCount: number;
      readonly visitedCount: number;
      readonly truncated: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        SpatialIndexReason,
        "spatial_cell_out_of_range" | "spatial_chunk_out_of_range" | "spatial_region_out_of_range"
      >;
    };

export interface SpatialIndexOptions {
  readonly capacity: number;
  readonly cellCount: number;
  readonly chunkCount: number;
  readonly regionCapacity: number;
}

export interface SpatialIndexMetrics {
  readonly indexedEntityCount: number;
  readonly cellMembershipCount: number;
  readonly chunkMembershipCount: number;
  readonly regionMembershipCount: number;
  readonly backlogCount: number;
}

export class SpatialIndex {
  readonly capacity: number;
  readonly cellCount: number;
  readonly chunkCount: number;
  readonly regionCapacity: number;

  private readonly indexed: Uint8Array;
  private readonly generations: Uint32Array;
  private readonly cellHead: Int32Array;
  private readonly cellNext: Int32Array;
  private readonly cellPrevious: Int32Array;
  private readonly chunkHead: Int32Array;
  private readonly chunkNext: Int32Array;
  private readonly chunkPrevious: Int32Array;
  private readonly regionHead: Int32Array;
  private readonly regionNext: Int32Array;
  private readonly regionPrevious: Int32Array;
  private indexedCount = 0;

  constructor(options: SpatialIndexOptions) {
    assertValidCapacity(options.capacity, "spatial index capacity");
    assertValidCapacity(options.cellCount, "spatial cell count");
    assertValidCapacity(options.chunkCount, "spatial chunk count");
    assertValidCapacity(options.regionCapacity, "spatial region capacity");

    this.capacity = options.capacity;
    this.cellCount = options.cellCount;
    this.chunkCount = options.chunkCount;
    this.regionCapacity = options.regionCapacity;
    this.indexed = new Uint8Array(options.capacity);
    this.generations = new Uint32Array(options.capacity);
    this.cellHead = createEmptyLinks(options.cellCount);
    this.cellNext = createEmptyLinks(options.capacity);
    this.cellPrevious = createEmptyLinks(options.capacity);
    this.chunkHead = createEmptyLinks(options.chunkCount);
    this.chunkNext = createEmptyLinks(options.capacity);
    this.chunkPrevious = createEmptyLinks(options.capacity);
    this.regionHead = createEmptyLinks(options.regionCapacity);
    this.regionNext = createEmptyLinks(options.capacity);
    this.regionPrevious = createEmptyLinks(options.capacity);
  }

  get activeCount(): number {
    return this.indexedCount;
  }

  insert(
    entityIndex: number,
    generation: number,
    cellIndex: number,
    chunkIndex: number,
    regionId: number,
  ): SpatialIndexMutationResult {
    const validation = this.validateInsert(entityIndex, cellIndex, chunkIndex, regionId);

    if (!validation.ok) {
      return validation;
    }

    this.indexed[entityIndex] = 1;
    this.generations[entityIndex] = generation;
    insertSorted(this.cellHead, this.cellNext, this.cellPrevious, cellIndex, entityIndex);
    insertSorted(this.chunkHead, this.chunkNext, this.chunkPrevious, chunkIndex, entityIndex);
    insertSorted(this.regionHead, this.regionNext, this.regionPrevious, regionId, entityIndex);
    this.indexedCount += 1;
    return {
      ok: true,
    };
  }

  remove(
    entityIndex: number,
    cellIndex: number,
    chunkIndex: number,
    regionId: number,
  ): SpatialIndexMutationResult {
    const validation = this.validateRemove(entityIndex, cellIndex, chunkIndex, regionId);

    if (!validation.ok) {
      return validation;
    }

    removeLinked(this.cellHead, this.cellNext, this.cellPrevious, cellIndex, entityIndex);
    removeLinked(this.chunkHead, this.chunkNext, this.chunkPrevious, chunkIndex, entityIndex);
    removeLinked(this.regionHead, this.regionNext, this.regionPrevious, regionId, entityIndex);
    this.indexed[entityIndex] = 0;
    this.generations[entityIndex] = 0;
    this.indexedCount -= 1;
    return {
      ok: true,
    };
  }

  queryCell(
    cellIndex: number,
    outputIndexes: Uint32Array,
    outputGenerations?: Uint32Array,
  ): SpatialIndexQueryResult {
    if (!isIndexInRange(cellIndex, this.cellCount)) {
      return { ok: false, reason: "spatial_cell_out_of_range" };
    }

    return queryLinked(
      this.cellHead[cellIndex] ?? -1,
      this.cellNext,
      this.generations,
      outputIndexes,
      outputGenerations,
    );
  }

  queryChunk(
    chunkIndex: number,
    outputIndexes: Uint32Array,
    outputGenerations?: Uint32Array,
  ): SpatialIndexQueryResult {
    if (!isIndexInRange(chunkIndex, this.chunkCount)) {
      return { ok: false, reason: "spatial_chunk_out_of_range" };
    }

    return queryLinked(
      this.chunkHead[chunkIndex] ?? -1,
      this.chunkNext,
      this.generations,
      outputIndexes,
      outputGenerations,
    );
  }

  queryRegion(
    regionId: number,
    outputIndexes: Uint32Array,
    outputGenerations?: Uint32Array,
  ): SpatialIndexQueryResult {
    if (!isIndexInRange(regionId, this.regionCapacity)) {
      return { ok: false, reason: "spatial_region_out_of_range" };
    }

    return queryLinked(
      this.regionHead[regionId] ?? -1,
      this.regionNext,
      this.generations,
      outputIndexes,
      outputGenerations,
    );
  }

  has(entityIndex: number): boolean {
    return isIndexInRange(entityIndex, this.capacity) && this.indexed[entityIndex] === 1;
  }

  createMetrics(): SpatialIndexMetrics {
    return {
      indexedEntityCount: this.indexedCount,
      cellMembershipCount: this.indexedCount,
      chunkMembershipCount: this.indexedCount,
      regionMembershipCount: this.indexedCount,
      backlogCount: 0,
    };
  }

  private validateInsert(
    entityIndex: number,
    cellIndex: number,
    chunkIndex: number,
    regionId: number,
  ): SpatialIndexMutationResult {
    const common = this.validateCommon(entityIndex, cellIndex, chunkIndex, regionId);

    if (!common.ok) {
      return common;
    }

    if (this.indexed[entityIndex] === 1) {
      return { ok: false, reason: "spatial_entity_already_indexed" };
    }

    return { ok: true };
  }

  private validateRemove(
    entityIndex: number,
    cellIndex: number,
    chunkIndex: number,
    regionId: number,
  ): SpatialIndexMutationResult {
    const common = this.validateCommon(entityIndex, cellIndex, chunkIndex, regionId);

    if (!common.ok) {
      return common;
    }

    if (this.indexed[entityIndex] !== 1) {
      return { ok: false, reason: "spatial_entity_not_indexed" };
    }

    return { ok: true };
  }

  private validateCommon(
    entityIndex: number,
    cellIndex: number,
    chunkIndex: number,
    regionId: number,
  ): SpatialIndexMutationResult {
    if (!isIndexInRange(entityIndex, this.capacity)) {
      return { ok: false, reason: "spatial_entity_index_out_of_range" };
    }

    if (!isIndexInRange(cellIndex, this.cellCount)) {
      return { ok: false, reason: "spatial_cell_out_of_range" };
    }

    if (!isIndexInRange(chunkIndex, this.chunkCount)) {
      return { ok: false, reason: "spatial_chunk_out_of_range" };
    }

    if (!isIndexInRange(regionId, this.regionCapacity)) {
      return { ok: false, reason: "spatial_region_out_of_range" };
    }

    return { ok: true };
  }
}

export function createSpatialIndex(options: SpatialIndexOptions): SpatialIndex {
  return new SpatialIndex(options);
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function insertSorted(
  heads: Int32Array,
  next: Int32Array,
  previous: Int32Array,
  bucket: number,
  entityIndex: number,
): void {
  let current = heads[bucket] ?? -1;
  let before = -1;

  while (current >= 0 && current < entityIndex) {
    before = current;
    current = next[current] ?? -1;
  }

  previous[entityIndex] = before;
  next[entityIndex] = current;

  if (before < 0) {
    heads[bucket] = entityIndex;
  } else {
    next[before] = entityIndex;
  }

  if (current >= 0) {
    previous[current] = entityIndex;
  }
}

function removeLinked(
  heads: Int32Array,
  next: Int32Array,
  previous: Int32Array,
  bucket: number,
  entityIndex: number,
): void {
  const before = previous[entityIndex] ?? -1;
  const after = next[entityIndex] ?? -1;

  if (before < 0) {
    heads[bucket] = after;
  } else {
    next[before] = after;
  }

  if (after >= 0) {
    previous[after] = before;
  }

  previous[entityIndex] = -1;
  next[entityIndex] = -1;
}

function queryLinked(
  head: number,
  next: Int32Array,
  generations: Uint32Array,
  outputIndexes: Uint32Array,
  outputGenerations: Uint32Array | undefined,
): SpatialIndexQueryResult {
  let count = 0;
  let totalCount = 0;
  let current = head;

  while (current >= 0) {
    if (count < outputIndexes.length) {
      outputIndexes[count] = current;

      if (outputGenerations !== undefined && count < outputGenerations.length) {
        outputGenerations[count] = generations[current] ?? 0;
      }

      count += 1;
    }

    totalCount += 1;
    current = next[current] ?? -1;
  }

  return {
    ok: true,
    count,
    totalCount,
    visitedCount: totalCount,
    truncated: totalCount > outputIndexes.length,
  };
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}
