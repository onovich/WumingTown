import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";

export type ComponentStoreReason =
  | "component_index_out_of_range"
  | "component_already_attached"
  | "component_missing"
  | "component_entity_not_alive"
  | "component_entity_generation_mismatch";

export type ComponentStoreResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: ComponentStoreReason;
    };

export type ComponentReadResult =
  | {
      readonly ok: true;
      readonly value: number;
    }
  | {
      readonly ok: false;
      readonly reason: ComponentStoreReason;
    };

export interface Int32ComponentStoreOptions {
  readonly capacity: number;
}

export class Int32ComponentStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly generations: Uint32Array;
  private readonly values: Int32Array;
  private attachedCount = 0;

  constructor(options: Int32ComponentStoreOptions) {
    assertValidCapacity(options.capacity, "component capacity");
    this.capacity = options.capacity;
    this.active = new Uint8Array(options.capacity);
    this.generations = new Uint32Array(options.capacity);
    this.values = new Int32Array(options.capacity);
  }

  get activeCount(): number {
    return this.attachedCount;
  }

  attach(entity: EntityId, registry: EntityRegistry, value: number): ComponentStoreResult {
    const validation = this.validateLiveEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    if (this.hasLocal(entity)) {
      return {
        ok: false,
        reason: "component_already_attached",
      };
    }

    const wasActive = this.active[entity.index] === 1;
    this.active[entity.index] = 1;
    this.generations[entity.index] = entity.generation;
    this.values[entity.index] = requireInt32(value, "component value");

    if (!wasActive) {
      this.attachedCount += 1;
    }

    return {
      ok: true,
    };
  }

  detach(entity: EntityId, registry: EntityRegistry): ComponentStoreResult {
    const validation = this.validateLiveEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    if (!this.hasLocal(entity)) {
      return {
        ok: false,
        reason: "component_missing",
      };
    }

    this.clearIndex(entity.index);
    return {
      ok: true,
    };
  }

  set(entity: EntityId, registry: EntityRegistry, value: number): ComponentStoreResult {
    const validation = this.validateLiveEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    if (!this.hasLocal(entity)) {
      return {
        ok: false,
        reason: "component_missing",
      };
    }

    this.values[entity.index] = requireInt32(value, "component value");
    return {
      ok: true,
    };
  }

  read(entity: EntityId, registry: EntityRegistry): ComponentReadResult {
    const validation = this.validateLiveEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    if (!this.hasLocal(entity)) {
      return {
        ok: false,
        reason: "component_missing",
      };
    }

    return {
      ok: true,
      value: this.values[entity.index] ?? 0,
    };
  }

  has(entity: EntityId, registry: EntityRegistry): boolean {
    return this.validateLiveEntity(entity, registry).ok && this.hasLocal(entity);
  }

  removeByIndex(index: number): boolean {
    if (!this.isEntityIndexInRange(index) || this.active[index] !== 1) {
      return false;
    }

    this.clearIndex(index);
    return true;
  }

  forEachAttachedAscending(
    registry: EntityRegistry,
    visitor: (index: number, generation: number, value: number) => void,
  ): void {
    for (let index = 0; index < this.capacity; index += 1) {
      if (this.isLiveAttachedIndex(index, registry)) {
        visitor(index, this.generations[index] ?? 0, this.values[index] ?? 0);
      }
    }
  }

  private validateLiveEntity(entity: EntityId, registry: EntityRegistry): ComponentStoreResult {
    if (!this.isEntityIndexInRange(entity.index)) {
      return {
        ok: false,
        reason: "component_index_out_of_range",
      };
    }

    const validation = registry.validate(entity);

    if (validation.ok) {
      return {
        ok: true,
      };
    }

    if (validation.reason === "entity_generation_mismatch") {
      return {
        ok: false,
        reason: "component_entity_generation_mismatch",
      };
    }

    return {
      ok: false,
      reason: "component_entity_not_alive",
    };
  }

  private isLiveAttachedIndex(index: number, registry: EntityRegistry): boolean {
    return (
      this.active[index] === 1 &&
      registry.isIndexActive(index) &&
      registry.generationAt(index) === this.generations[index]
    );
  }

  private hasLocal(entity: EntityId): boolean {
    if (!this.isEntityIndexInRange(entity.index)) {
      return false;
    }

    return this.active[entity.index] === 1 && this.generations[entity.index] === entity.generation;
  }

  private clearIndex(index: number): void {
    this.active[index] = 0;
    this.generations[index] = 0;
    this.values[index] = 0;
    this.attachedCount -= 1;
  }

  private isEntityIndexInRange(index: number): boolean {
    return Number.isSafeInteger(index) && index >= 0 && index < this.capacity;
  }
}

export function createInt32ComponentStore(
  options: Int32ComponentStoreOptions,
): Int32ComponentStore {
  return new Int32ComponentStore(options);
}

function requireInt32(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
    throw new Error(`${label} must be a signed 32-bit integer`);
  }

  return value;
}
