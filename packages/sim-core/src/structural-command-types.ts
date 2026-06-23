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
  | "command_value_out_of_range"
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
      readonly reason: Extract<
        StructuralCommandReason,
        "command_buffer_capacity_exhausted" | "command_value_out_of_range"
      >;
    };

export type StructuralCommandReasonSlot = StructuralCommandReason | "none";

export interface StructuralCommandResultView {
  ok: boolean;
  sequence: number;
  kind: StructuralCommandKind;
  index: number;
  generation: number;
  value: number;
  reason: StructuralCommandReasonSlot;
}

export type StructuralCommandResult = StructuralCommandResultView;

export interface StructuralCommitReport {
  readonly appliedCount: number;
  readonly failedCount: number;
  readonly resultCount: number;
  readonly ok: Uint8Array;
  readonly kinds: Uint8Array;
  readonly sequences: Uint32Array;
  readonly indexes: Int32Array;
  readonly generations: Uint32Array;
  readonly values: Float64Array;
  readonly reasons: readonly StructuralCommandReasonSlot[];
}

export interface MutableStructuralCommitReport {
  appliedCount: number;
  failedCount: number;
  resultCount: number;
  readonly ok: Uint8Array;
  readonly kinds: Uint8Array;
  readonly sequences: Uint32Array;
  readonly indexes: Int32Array;
  readonly generations: Uint32Array;
  readonly values: Float64Array;
  readonly reasons: StructuralCommandReasonSlot[];
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

export function createStructuralCommandResultView(): StructuralCommandResultView {
  return {
    ok: false,
    sequence: 0,
    kind: "allocate",
    index: -1,
    generation: 0,
    value: 0,
    reason: "none",
  };
}

export function readStructuralCommandResult(
  report: StructuralCommitReport,
  ordinal: number,
  output: StructuralCommandResultView,
): boolean {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= report.resultCount) {
    return false;
  }

  const kind = commandKindName(report.kinds[ordinal]);

  if (kind === undefined) {
    return false;
  }

  const reason = report.reasons[ordinal];

  if (reason === undefined) {
    return false;
  }

  output.ok = report.ok[ordinal] === 1;
  output.sequence = report.sequences[ordinal] ?? 0;
  output.kind = kind;
  output.index = report.indexes[ordinal] ?? -1;
  output.generation = report.generations[ordinal] ?? 0;
  output.value = report.values[ordinal] ?? 0;
  output.reason = reason;
  return true;
}

export function isInt32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
}

function commandKindName(kind: number | undefined): StructuralCommandKind | undefined {
  if (kind === COMMAND_ALLOCATE) {
    return "allocate";
  }

  if (kind === COMMAND_DESTROY) {
    return "destroy";
  }

  if (kind === COMMAND_ATTACH_I32) {
    return "attach-i32";
  }

  if (kind === COMMAND_DETACH_I32) {
    return "detach-i32";
  }

  if (kind === COMMAND_SET_I32) {
    return "set-i32";
  }

  return undefined;
}
