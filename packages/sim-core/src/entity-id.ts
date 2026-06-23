export const MAX_ENTITY_GENERATION = 0xffff_ffff;

export interface EntityId {
  readonly index: number;
  readonly generation: number;
}

export type EntityRegistryReason =
  | "entity_capacity_exhausted"
  | "entity_index_out_of_range"
  | "entity_generation_mismatch"
  | "entity_slot_not_alive"
  | "entity_generation_exhausted";

export type EntityAllocationResult =
  | {
      readonly ok: true;
      readonly entity: EntityId;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<EntityRegistryReason, "entity_capacity_exhausted">;
    };

export type EntityDestroyResult =
  | {
      readonly ok: true;
      readonly entity: EntityId;
      readonly nextGeneration: number;
    }
  | {
      readonly ok: false;
      readonly reason: EntityRegistryReason;
    };

export type EntityValidationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: EntityRegistryReason;
    };

export interface EntityRegistryOptions {
  readonly capacity: number;
}

export class EntityRegistry {
  readonly capacity: number;

  private readonly generations: Uint32Array;
  private readonly active: Uint8Array;
  private readonly freeStack: Uint32Array;
  private freeCount = 0;
  private nextUnusedIndex = 0;
  private liveCount = 0;

  constructor(options: EntityRegistryOptions) {
    assertValidCapacity(options.capacity, "entity capacity");
    this.capacity = options.capacity;
    this.generations = new Uint32Array(options.capacity);
    this.active = new Uint8Array(options.capacity);
    this.freeStack = new Uint32Array(options.capacity);
  }

  get activeCount(): number {
    return this.liveCount;
  }

  allocate(): EntityAllocationResult {
    const index = this.takeAvailableIndex();

    if (index < 0) {
      return {
        ok: false,
        reason: "entity_capacity_exhausted",
      };
    }

    let generation = this.generations[index] ?? 0;
    if (generation === 0) {
      generation = 1;
      this.generations[index] = generation;
    }

    this.active[index] = 1;
    this.liveCount += 1;

    return {
      ok: true,
      entity: {
        index,
        generation,
      },
    };
  }

  destroy(entity: EntityId): EntityDestroyResult {
    const validation = this.validate(entity);

    if (!validation.ok) {
      return validation;
    }

    if (entity.generation >= MAX_ENTITY_GENERATION) {
      return {
        ok: false,
        reason: "entity_generation_exhausted",
      };
    }

    const nextGeneration = entity.generation + 1;
    this.active[entity.index] = 0;
    this.generations[entity.index] = nextGeneration;
    this.freeStack[this.freeCount] = entity.index;
    this.freeCount += 1;
    this.liveCount -= 1;

    return {
      ok: true,
      entity,
      nextGeneration,
    };
  }

  validate(entity: EntityId): EntityValidationResult {
    if (!Number.isSafeInteger(entity.index) || entity.index < 0 || entity.index >= this.capacity) {
      return {
        ok: false,
        reason: "entity_index_out_of_range",
      };
    }

    if (this.active[entity.index] !== 1) {
      return {
        ok: false,
        reason: "entity_slot_not_alive",
      };
    }

    if (this.generations[entity.index] !== entity.generation) {
      return {
        ok: false,
        reason: "entity_generation_mismatch",
      };
    }

    return {
      ok: true,
    };
  }

  isAlive(entity: EntityId): boolean {
    return this.validate(entity).ok;
  }

  generationAt(index: number): number {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) {
      return 0;
    }

    return this.generations[index] ?? 0;
  }

  isIndexActive(index: number): boolean {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) {
      return false;
    }

    return this.active[index] === 1;
  }

  forEachAliveAscending(visitor: (index: number, generation: number) => void): void {
    for (let index = 0; index < this.capacity; index += 1) {
      if (this.active[index] === 1) {
        visitor(index, this.generations[index] ?? 0);
      }
    }
  }

  private takeAvailableIndex(): number {
    if (this.freeCount > 0) {
      this.freeCount -= 1;
      return this.freeStack[this.freeCount] ?? -1;
    }

    if (this.nextUnusedIndex >= this.capacity) {
      return -1;
    }

    const index = this.nextUnusedIndex;
    this.nextUnusedIndex += 1;
    return index;
  }
}

export function createEntityRegistry(options: EntityRegistryOptions): EntityRegistry {
  return new EntityRegistry(options);
}

export function sameEntity(left: EntityId, right: EntityId): boolean {
  return left.index === right.index && left.generation === right.generation;
}

export function assertValidCapacity(capacity: number, label: string): void {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}
