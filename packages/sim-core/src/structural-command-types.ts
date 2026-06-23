import { type EntityId } from "./entity-id";

export const COMMAND_ALLOCATE = 1;
export const COMMAND_DESTROY = 2;
export const COMMAND_ATTACH_I32 = 3;
export const COMMAND_DETACH_I32 = 4;
export const COMMAND_SET_I32 = 5;

export type CommandCode =
  | typeof COMMAND_ALLOCATE
  | typeof COMMAND_DESTROY
  | typeof COMMAND_ATTACH_I32
  | typeof COMMAND_DETACH_I32
  | typeof COMMAND_SET_I32;

export type StructuralCommandKind =
  | "allocate"
  | "destroy"
  | "attach-i32"
  | "detach-i32"
  | "set-i32";

export type StructuralCommandReason =
  | "command_buffer_capacity_exhausted"
  | "entity_capacity_exhausted"
  | "entity_index_out_of_range"
  | "entity_generation_mismatch"
  | "entity_slot_not_alive"
  | "entity_generation_exhausted"
  | "component_index_out_of_range"
  | "component_already_attached"
  | "component_missing"
  | "component_entity_not_alive"
  | "component_entity_generation_mismatch";

export type QueueStructuralCommandResult =
  | {
      readonly ok: true;
      readonly sequence: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<StructuralCommandReason, "command_buffer_capacity_exhausted">;
    };

export type StructuralCommandResult =
  | {
      readonly ok: true;
      readonly sequence: number;
      readonly kind: StructuralCommandKind;
      readonly entity?: EntityId;
      readonly value?: number;
    }
  | {
      readonly ok: false;
      readonly sequence: number;
      readonly kind: StructuralCommandKind;
      readonly reason: StructuralCommandReason;
    };

export interface StructuralCommitReport {
  readonly appliedCount: number;
  readonly failedCount: number;
  readonly results: readonly StructuralCommandResult[];
}

export function isCommandCode(value: number | undefined): value is CommandCode {
  return (
    value === COMMAND_ALLOCATE ||
    value === COMMAND_DESTROY ||
    value === COMMAND_ATTACH_I32 ||
    value === COMMAND_DETACH_I32 ||
    value === COMMAND_SET_I32
  );
}

export function commandPriority(kind: CommandCode): number {
  if (kind === COMMAND_DESTROY) {
    return 0;
  }

  if (kind === COMMAND_DETACH_I32) {
    return 1;
  }

  if (kind === COMMAND_ATTACH_I32) {
    return 2;
  }

  if (kind === COMMAND_SET_I32) {
    return 3;
  }

  return 4;
}
