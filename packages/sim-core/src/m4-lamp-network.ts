import type { MapGrid } from "./map-grid";
import type { CanonicalWorldField } from "./world-hash";

export const M4_LAMP_NETWORK_SNAPSHOT_VERSION = 2;
export const M4_LAMP_NONE = 0xffff_ffff;
export const M4_LAMP_DEFAULT_DIRTY_DRAIN_BUDGET = 64;
export const M4_LAMP_MAINTENANCE_OK = 0;
export const M4_LAMP_MAINTENANCE_NEEDS_FUEL = 1;
export const M4_LAMP_MAINTENANCE_NEEDS_WICK = 2;
export const M4_LAMP_MAINTENANCE_DAMAGED = 3;
export const M4_LAMP_TAG_HOME = 1 << 0;
export const M4_LAMP_TAG_ROAD = 1 << 1;
export const M4_LAMP_TAG_NIGHT_WATCH = 1 << 2;
export const M4_LAMP_TAG_BOUNDARY = 1 << 3;
export const M4_LAMP_TAG_GUEST = 1 << 4;
export const M4_LAMP_TAG_FORBIDDEN = 1 << 5;
export const M4_LAMP_TAG_MASK =
  M4_LAMP_TAG_HOME |
  M4_LAMP_TAG_ROAD |
  M4_LAMP_TAG_NIGHT_WATCH |
  M4_LAMP_TAG_BOUNDARY |
  M4_LAMP_TAG_GUEST |
  M4_LAMP_TAG_FORBIDDEN;

export type M4LampMaintenanceState =
  | typeof M4_LAMP_MAINTENANCE_OK
  | typeof M4_LAMP_MAINTENANCE_NEEDS_FUEL
  | typeof M4_LAMP_MAINTENANCE_NEEDS_WICK
  | typeof M4_LAMP_MAINTENANCE_DAMAGED;

export type M4LampChangeReason =
  | "lamp.registered"
  | "lamp.maintenance_changed"
  | "lamp.fuel_changed"
  | "lamp.wick_changed"
  | "lamp.damage_changed"
  | "lamp.human_claim_changed"
  | "lamp.shadow_gap_changed"
  | "lamp.group_changed";

export type M4LampOperationReason =
  | "lamp.maintenance_changed"
  | "lamp.fuel_changed"
  | "lamp.wick_changed"
  | "lamp.damage_changed";

export type M4LampDirtyMode = "none" | "coalesce" | "append";

const M4_LAMP_COMMIT = Symbol("m4-lamp-commit");

export type M4LampReason =
  | "lamp_id_out_of_range"
  | "lamp_group_out_of_range"
  | "lamp_group_not_registered"
  | "lamp_already_registered"
  | "lamp_not_registered"
  | "lamp_cell_out_of_range"
  | "lamp_value_out_of_range"
  | "lamp_dirty_queue_full"
  | "lamp_dirty_budget_invalid"
  | "lamp_dirty_output_too_small"
  | "lamp_projection_read_only"
  | "lamp_projection_stale_basis"
  | "lamp_map_cell_unreadable"
  | "lamp_version_exhausted";

export interface M4LampNetworkStoreOptions {
  readonly lampCapacity: number;
  readonly groupCapacity: number;
  readonly dirtyCapacity?: number;
}

export interface M4LampRegisterInput {
  readonly lampId: number;
  readonly groupId: number;
  readonly cellIndex: number;
  readonly roomId: number;
  readonly chunkIndex: number;
  readonly tagMask: number;
  readonly fuel: number;
  readonly wick: number;
  readonly damage: number;
  readonly maintenanceState: M4LampMaintenanceState;
  readonly humanClaim: number;
  readonly shadowGap: number;
}

export interface M4LampMapRegisterInput extends Omit<M4LampRegisterInput, "roomId" | "chunkIndex"> {
  readonly map: MapGrid;
}

export interface M4LampRuleFieldUpdate {
  readonly lampId: number;
  readonly groupId?: number;
  readonly fuel?: number;
  readonly wick?: number;
  readonly damage?: number;
  readonly maintenanceState?: M4LampMaintenanceState;
  readonly humanClaim?: number;
  readonly shadowGap?: number;
  readonly reason: M4LampChangeReason;
}

export type M4LampMutationResult =
  | {
      readonly ok: true;
      readonly lampId: number;
      readonly groupId: number;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly lampVersion: number;
      readonly reason: M4LampChangeReason;
    }
  | { readonly ok: false; readonly reason: M4LampReason };

export interface M4LampView {
  readonly lampId: number;
  readonly groupId: number;
  readonly cellIndex: number;
  readonly roomId: number;
  readonly chunkIndex: number;
  readonly tagMask: number;
  readonly fuel: number;
  readonly wick: number;
  readonly damage: number;
  readonly maintenanceState: M4LampMaintenanceState;
  readonly humanClaim: number;
  readonly shadowGap: number;
  readonly lampVersion: number;
  readonly ownerVersion: number;
}

export interface M4LampIntoOutput {
  ok: boolean;
  reason: M4LampReason | undefined;
  active: boolean;
  lampId: number;
  groupId: number;
  cellIndex: number;
  roomId: number;
  chunkIndex: number;
  tagMask: number;
  fuel: number;
  wick: number;
  damage: number;
  maintenanceState: M4LampMaintenanceState;
  humanClaim: number;
  shadowGap: number;
  lampVersion: number;
  ownerVersion: number;
  groupVersion: number;
  dirtyQueued: boolean;
  dirtyReason: M4LampChangeReason;
  dirtySequence: number;
  dirtyCapacity: number;
  dirtyHead: number;
  dirtyCount: number;
  nextDirtySequence: number;
}

export interface M4LampPrepareInput {
  readonly lampId: number;
  readonly expectedGroupId: number;
  readonly expectedOwnerVersion: number;
  readonly expectedLampVersion: number;
  readonly expectedGroupVersion: number;
  readonly expectedFuel: number;
  readonly expectedWick: number;
  readonly expectedDamage: number;
  readonly expectedMaintenanceState: M4LampMaintenanceState;
  readonly expectedDirtyQueued: boolean;
  readonly expectedDirtyReason: M4LampChangeReason;
  readonly expectedDirtySequence: number;
  readonly expectedDirtyCapacity: number;
  readonly expectedDirtyHead: number;
  readonly expectedDirtyCount: number;
  readonly expectedNextDirtySequence: number;
  readonly nextFuel: number;
  readonly nextWick: number;
  readonly nextDamage: number;
  readonly nextMaintenanceState: M4LampMaintenanceState;
  readonly reason: M4LampOperationReason;
}

export interface PreparedM4LampMutation {
  ok: boolean;
  reason: M4LampReason | undefined;
  lampId: number;
  groupId: number;
  changed: boolean;
  operationReasonCode: number;
  previousFuel: number;
  nextFuel: number;
  previousWick: number;
  nextWick: number;
  previousDamage: number;
  nextDamage: number;
  previousMaintenanceState: M4LampMaintenanceState;
  nextMaintenanceState: M4LampMaintenanceState;
  previousOwnerVersion: number;
  nextOwnerVersion: number;
  previousLampVersion: number;
  nextLampVersion: number;
  previousGroupVersion: number;
  nextGroupVersion: number;
  previousDirtyQueued: boolean;
  nextDirtyQueued: boolean;
  previousDirtyReasonCode: number;
  nextDirtyReasonCode: number;
  previousDirtySequence: number;
  nextDirtySequence: number;
  previousDirtyHead: number;
  nextDirtyHead: number;
  previousDirtyCount: number;
  nextDirtyCount: number;
  previousDirtyCapacity: number;
  nextDirtyCapacity: number;
  previousNextDirtySequence: number;
  nextNextDirtySequence: number;
  dirtyMode: M4LampDirtyMode;
  appendTail: number;
  nextDirtyPeak: number;
}

export interface M4LampDirtyKeyView {
  readonly sequence: number;
  readonly lampId: number;
  readonly groupId: number;
  readonly cellIndex: number;
  readonly roomId: number;
  readonly chunkIndex: number;
  readonly projectionKey: number;
  readonly lampVersion: number;
  readonly ownerVersion: number;
  readonly reason: M4LampChangeReason;
}

export interface M4LampDirtyKeyOutput {
  sequence: number;
  lampId: number;
  groupId: number;
  cellIndex: number;
  roomId: number;
  chunkIndex: number;
  projectionKey: number;
  lampVersion: number;
  ownerVersion: number;
  reason: M4LampChangeReason;
}

export type M4LampDirtyDrainResult =
  | {
      readonly ok: true;
      readonly processedCount: number;
      readonly remainingCount: number;
      readonly budget: number;
      readonly ownerVersion: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        M4LampReason,
        "lamp_dirty_budget_invalid" | "lamp_dirty_output_too_small"
      >;
    };

export interface M4LampNetworkMetrics {
  readonly ownerVersion: number;
  readonly activeLampCount: number;
  readonly activeGroupCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly dirtyDrainCount: number;
  readonly dirtyDrainedKeyCount: number;
  readonly lastDrainProcessedCount: number;
  readonly normalTickVisitedLampCount: number;
  readonly normalTickVisitedCellCount: number;
  readonly fullMapDiffusionCount: number;
}

export interface M4LampVisualProjectionRow {
  readonly lampId: number;
  readonly groupId: number;
  readonly cellIndex: number;
  readonly roomId: number;
  readonly chunkIndex: number;
  readonly visualLight: number;
  readonly basisLampVersion: number;
}

export interface M4LampVisualProjection {
  readonly readOnly: true;
  readonly basisOwnerVersion: number;
  readonly rowCount: number;
  readonly rows: readonly M4LampVisualProjectionRow[];
}

export interface M4LampNetworkSnapshot {
  readonly version: typeof M4_LAMP_NETWORK_SNAPSHOT_VERSION;
  readonly ownerVersion: number;
  readonly activeLampCount: number;
  readonly activeGroupCount: number;
  readonly lampCapacity: number;
  readonly groupCapacity: number;
  readonly dirtyCapacity: number;
  readonly active: Uint8Array;
  readonly groupActive: Uint8Array;
  readonly groupLampCounts: Uint32Array;
  readonly groupVersions: Uint32Array;
  readonly groupIds: Uint32Array;
  readonly cellIndexes: Uint32Array;
  readonly roomIds: Uint32Array;
  readonly chunkIndexes: Uint32Array;
  readonly tagMasks: Uint32Array;
  readonly fuels: Uint32Array;
  readonly wicks: Uint32Array;
  readonly damages: Uint32Array;
  readonly maintenanceStates: Uint8Array;
  readonly humanClaims: Uint32Array;
  readonly shadowGaps: Uint32Array;
  readonly lampVersions: Uint32Array;
  readonly dirtyQueued: Uint8Array;
  readonly dirtyQueue: Uint32Array;
  readonly dirtyReasons: Uint8Array;
  readonly dirtySequences: Uint32Array;
  readonly dirtyHead: number;
  readonly dirtyCount: number;
  readonly nextDirtySequence: number;
}

type NumericLane = Uint8Array | Uint32Array;

export class M4LampNetworkStore {
  readonly lampCapacity: number;
  readonly groupCapacity: number;
  readonly dirtyCapacity: number;

  private readonly active: Uint8Array;
  private readonly groupActive: Uint8Array;
  private readonly groupLampCounts: Uint32Array;
  private readonly groupVersions: Uint32Array;
  private readonly groupIds: Uint32Array;
  private readonly cellIndexes: Uint32Array;
  private readonly roomIds: Uint32Array;
  private readonly chunkIndexes: Uint32Array;
  private readonly tagMasks: Uint32Array;
  private readonly fuels: Uint32Array;
  private readonly wicks: Uint32Array;
  private readonly damages: Uint32Array;
  private readonly maintenanceStates: Uint8Array;
  private readonly humanClaims: Uint32Array;
  private readonly shadowGaps: Uint32Array;
  private readonly lampVersions: Uint32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private readonly dirtyReasons: Uint8Array;
  private readonly dirtySequences: Uint32Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private dirtyDrainCount = 0;
  private dirtyDrainedKeyCount = 0;
  private lastDrainProcessedCount = 0;
  private normalTickVisitedLampCount = 0;
  private normalTickVisitedCellCount = 0;
  private fullMapDiffusionCount = 0;
  private activeLampCountValue = 0;
  private activeGroupCountValue = 0;
  private ownerVersionValue = 0;
  private dirtySequence = 1;

  constructor(options: M4LampNetworkStoreOptions) {
    this.lampCapacity = requirePositiveSafeInteger(options.lampCapacity, "lamp capacity");
    this.groupCapacity = requirePositiveSafeInteger(options.groupCapacity, "lamp group capacity");
    this.dirtyCapacity = requirePositiveSafeInteger(
      options.dirtyCapacity ?? options.lampCapacity,
      "lamp dirty capacity",
    );
    this.active = new Uint8Array(this.lampCapacity);
    this.groupActive = new Uint8Array(this.groupCapacity);
    this.groupLampCounts = new Uint32Array(this.groupCapacity);
    this.groupVersions = new Uint32Array(this.groupCapacity);
    this.groupIds = new Uint32Array(this.lampCapacity);
    this.cellIndexes = new Uint32Array(this.lampCapacity);
    this.roomIds = new Uint32Array(this.lampCapacity);
    this.chunkIndexes = new Uint32Array(this.lampCapacity);
    this.tagMasks = new Uint32Array(this.lampCapacity);
    this.fuels = new Uint32Array(this.lampCapacity);
    this.wicks = new Uint32Array(this.lampCapacity);
    this.damages = new Uint32Array(this.lampCapacity);
    this.maintenanceStates = new Uint8Array(this.lampCapacity);
    this.humanClaims = new Uint32Array(this.lampCapacity);
    this.shadowGaps = new Uint32Array(this.lampCapacity);
    this.lampVersions = new Uint32Array(this.lampCapacity);
    this.dirtyQueued = new Uint8Array(this.lampCapacity);
    this.dirtyQueue = new Uint32Array(this.dirtyCapacity);
    this.dirtyReasons = new Uint8Array(this.lampCapacity);
    this.dirtySequences = new Uint32Array(this.lampCapacity);
    this.groupIds.fill(M4_LAMP_NONE);
    this.cellIndexes.fill(M4_LAMP_NONE);
    this.roomIds.fill(M4_LAMP_NONE);
    this.chunkIndexes.fill(M4_LAMP_NONE);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  get activeLampCount(): number {
    return this.activeLampCountValue;
  }

  get dirtyBacklog(): number {
    return this.dirtyCount;
  }

  registerGroup(groupId: number): M4LampMutationResult {
    if (!isIndexInRange(groupId, this.groupCapacity)) {
      return { ok: false, reason: "lamp_group_out_of_range" };
    }

    let changed = false;
    if ((this.groupActive[groupId] ?? 0) === 0) {
      if (!this.canAdvanceVersion()) {
        return { ok: false, reason: "lamp_version_exhausted" };
      }

      this.groupActive[groupId] = 1;
      this.activeGroupCountValue += 1;
      this.advanceVersion();
      this.groupVersions[groupId] = this.ownerVersionValue;
      changed = true;
    }

    return {
      ok: true,
      lampId: M4_LAMP_NONE,
      groupId,
      changed,
      ownerVersion: this.ownerVersionValue,
      lampVersion: 0,
      reason: "lamp.group_changed",
    };
  }

  registerLampAtMapCell(input: M4LampMapRegisterInput): M4LampMutationResult {
    const cell = input.map.readCellByIndex(input.cellIndex);
    if (!cell.ok) {
      return { ok: false, reason: "lamp_map_cell_unreadable" };
    }

    return this.registerLamp({
      lampId: input.lampId,
      groupId: input.groupId,
      cellIndex: input.cellIndex,
      roomId: cell.cell.roomId,
      chunkIndex: cell.cell.chunkIndex,
      tagMask: input.tagMask,
      fuel: input.fuel,
      wick: input.wick,
      damage: input.damage,
      maintenanceState: input.maintenanceState,
      humanClaim: input.humanClaim,
      shadowGap: input.shadowGap,
    });
  }

  registerLamp(input: M4LampRegisterInput): M4LampMutationResult {
    const validation = this.validateRegisterInput(input);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.lampId] ?? 0) === 1) {
      return { ok: false, reason: "lamp_already_registered" };
    }

    if (!this.canAdvanceVersion()) {
      return { ok: false, reason: "lamp_version_exhausted" };
    }

    if (this.dirtyCount >= this.dirtyCapacity) {
      return { ok: false, reason: "lamp_dirty_queue_full" };
    }

    if (!canAdvanceUint32(this.dirtySequence)) {
      return { ok: false, reason: "lamp_version_exhausted" };
    }

    const version = this.advanceVersion();
    this.active[input.lampId] = 1;
    this.groupIds[input.lampId] = input.groupId;
    this.cellIndexes[input.lampId] = input.cellIndex;
    this.roomIds[input.lampId] = input.roomId;
    this.chunkIndexes[input.lampId] = input.chunkIndex;
    this.tagMasks[input.lampId] = input.tagMask;
    this.fuels[input.lampId] = input.fuel;
    this.wicks[input.lampId] = input.wick;
    this.damages[input.lampId] = input.damage;
    this.maintenanceStates[input.lampId] = input.maintenanceState;
    this.humanClaims[input.lampId] = input.humanClaim;
    this.shadowGaps[input.lampId] = input.shadowGap;
    this.lampVersions[input.lampId] = version;
    this.groupLampCounts[input.groupId] = (this.groupLampCounts[input.groupId] ?? 0) + 1;
    this.groupVersions[input.groupId] = version;
    this.activeLampCountValue += 1;
    this.commitLampDirty(input.lampId, "lamp.registered");

    return {
      ok: true,
      lampId: input.lampId,
      groupId: input.groupId,
      changed: true,
      ownerVersion: version,
      lampVersion: version,
      reason: "lamp.registered",
    };
  }

  setRuleFields(update: M4LampRuleFieldUpdate): M4LampMutationResult {
    if (!this.isLampActive(update.lampId)) {
      return { ok: false, reason: "lamp_not_registered" };
    }

    if (!this.validateRuleUpdate(update)) {
      return { ok: false, reason: "lamp_value_out_of_range" };
    }

    if (!this.wouldRuleUpdateChange(update)) {
      return this.createMutation(update.lampId, false, update.reason);
    }

    if (!this.canAdvanceVersion()) {
      return { ok: false, reason: "lamp_version_exhausted" };
    }

    if ((this.dirtyQueued[update.lampId] ?? 0) === 0 && this.dirtyCount >= this.dirtyCapacity) {
      return { ok: false, reason: "lamp_dirty_queue_full" };
    }

    if ((this.dirtyQueued[update.lampId] ?? 0) === 0 && !canAdvanceUint32(this.dirtySequence)) {
      return { ok: false, reason: "lamp_version_exhausted" };
    }

    const version = this.ownerVersionValue + 1;

    if (update.groupId !== undefined && update.groupId !== this.groupIds[update.lampId]) {
      this.changeLampGroup(update.lampId, update.groupId, version);
    }

    setUint32(this.fuels, update.lampId, update.fuel);
    setUint32(this.wicks, update.lampId, update.wick);
    setUint32(this.damages, update.lampId, update.damage);
    setUint8(this.maintenanceStates, update.lampId, update.maintenanceState);
    setUint32(this.humanClaims, update.lampId, update.humanClaim);
    setUint32(this.shadowGaps, update.lampId, update.shadowGap);
    this.advanceVersion();
    const groupId = this.groupIds[update.lampId] ?? 0;
    this.lampVersions[update.lampId] = version;
    this.groupVersions[groupId] = version;
    this.commitLampDirty(update.lampId, update.reason);

    return this.createMutation(update.lampId, true, update.reason);
  }

  readLamp(lampId: number): M4LampView | undefined {
    if ((this.active[lampId] ?? 0) !== 1) {
      return undefined;
    }

    return this.readActiveLamp(lampId);
  }

  readLampInto(lampId: number, output: M4LampIntoOutput): void {
    resetLampInto(
      this.ownerVersionValue,
      this.dirtyCapacity,
      this.dirtyHead,
      this.dirtyCount,
      this.dirtySequence,
      output,
    );
    if (!isIndexInRange(lampId, this.lampCapacity)) {
      output.reason = "lamp_id_out_of_range";
      return;
    }
    output.lampId = lampId;
    if ((this.active[lampId] ?? 0) !== 1) {
      output.reason = "lamp_not_registered";
      return;
    }
    const groupId = this.groupIds[lampId] ?? 0;
    output.ok = true;
    output.active = true;
    output.groupId = groupId;
    output.cellIndex = this.cellIndexes[lampId] ?? 0;
    output.roomId = this.roomIds[lampId] ?? 0;
    output.chunkIndex = this.chunkIndexes[lampId] ?? 0;
    output.tagMask = this.tagMasks[lampId] ?? 0;
    output.fuel = this.fuels[lampId] ?? 0;
    output.wick = this.wicks[lampId] ?? 0;
    output.damage = this.damages[lampId] ?? 0;
    output.maintenanceState = decodeMaintenanceState(this.maintenanceStates[lampId] ?? 0);
    output.humanClaim = this.humanClaims[lampId] ?? 0;
    output.shadowGap = this.shadowGaps[lampId] ?? 0;
    output.lampVersion = this.lampVersions[lampId] ?? 0;
    output.ownerVersion = this.ownerVersionValue;
    output.groupVersion = this.groupVersions[groupId] ?? 0;
    output.dirtyQueued = this.dirtyQueued[lampId] === 1;
    output.dirtyReason = decodeLampChangeReason(this.dirtyReasons[lampId] ?? 0);
    output.dirtySequence = this.dirtySequences[lampId] ?? 0;
  }

  prepareRefillOrMaintenanceInto(input: M4LampPrepareInput, output: PreparedM4LampMutation): void {
    resetPreparedLamp(output);
    if (!isIndexInRange(input.lampId, this.lampCapacity)) {
      output.reason = "lamp_id_out_of_range";
      return;
    }
    if (!isIndexInRange(input.expectedGroupId, this.groupCapacity)) {
      output.reason = "lamp_group_out_of_range";
      return;
    }
    if ((this.active[input.lampId] ?? 0) !== 1) {
      output.reason = "lamp_not_registered";
      return;
    }
    if (!isValidLampPrepareScalars(input)) {
      output.reason = "lamp_value_out_of_range";
      return;
    }
    const groupId = this.groupIds[input.lampId] ?? 0;
    const dirtyReasonCode = this.dirtyReasons[input.lampId] ?? 0;
    const dirtyQueued = this.dirtyQueued[input.lampId] === 1;
    if (
      input.expectedGroupId !== groupId ||
      input.expectedOwnerVersion !== this.ownerVersionValue ||
      input.expectedLampVersion !== (this.lampVersions[input.lampId] ?? 0) ||
      input.expectedGroupVersion !== (this.groupVersions[groupId] ?? 0) ||
      input.expectedFuel !== (this.fuels[input.lampId] ?? 0) ||
      input.expectedWick !== (this.wicks[input.lampId] ?? 0) ||
      input.expectedDamage !== (this.damages[input.lampId] ?? 0) ||
      input.expectedMaintenanceState !==
        decodeMaintenanceState(this.maintenanceStates[input.lampId] ?? 0) ||
      input.expectedDirtyQueued !== dirtyQueued ||
      input.expectedDirtyReason !== decodeLampChangeReason(dirtyReasonCode) ||
      input.expectedDirtySequence !== (this.dirtySequences[input.lampId] ?? 0) ||
      input.expectedDirtyCapacity !== this.dirtyCapacity ||
      input.expectedDirtyHead !== this.dirtyHead ||
      input.expectedDirtyCount !== this.dirtyCount ||
      input.expectedNextDirtySequence !== this.dirtySequence
    ) {
      output.reason = "lamp_projection_stale_basis";
      return;
    }
    if (!hasValidLampDirection(input)) {
      output.reason = "lamp_value_out_of_range";
      return;
    }
    const changed = hasPreparedLampChange(input);
    if (changed && !hasPrimaryLampChange(input)) {
      output.reason = "lamp_value_out_of_range";
      return;
    }
    if (
      changed &&
      !canAdvancePreparedLampVersions(
        this.ownerVersionValue,
        this.lampVersions[input.lampId] ?? 0,
        this.groupVersions[groupId] ?? 0,
      )
    ) {
      output.reason = "lamp_version_exhausted";
      return;
    }
    if (changed && !dirtyQueued && this.dirtyCount >= this.dirtyCapacity) {
      output.reason = "lamp_dirty_queue_full";
      return;
    }
    if (changed && !dirtyQueued && !canAdvanceUint32(this.dirtySequence)) {
      output.reason = "lamp_version_exhausted";
      return;
    }
    writePreparedLamp(
      input,
      groupId,
      dirtyReasonCode,
      dirtyQueued,
      changed,
      this.ownerVersionValue,
      this.dirtyCapacity,
      this.dirtyHead,
      this.dirtyCount,
      this.dirtySequence,
      this.dirtyPeak,
      output,
    );
  }

  [M4_LAMP_COMMIT](prepared: PreparedM4LampMutation): void {
    if (!prepared.changed) return;
    const lampId = prepared.lampId;
    this.fuels[lampId] = prepared.nextFuel;
    this.wicks[lampId] = prepared.nextWick;
    this.damages[lampId] = prepared.nextDamage;
    this.maintenanceStates[lampId] = prepared.nextMaintenanceState;
    this.ownerVersionValue = prepared.nextOwnerVersion;
    this.lampVersions[lampId] = prepared.nextLampVersion;
    this.groupVersions[prepared.groupId] = prepared.nextGroupVersion;
    this.dirtyReasons[lampId] = prepared.nextDirtyReasonCode;
    if (prepared.dirtyMode === "append") {
      this.dirtyQueue[prepared.appendTail] = lampId;
      this.dirtyQueued[lampId] = 1;
      this.dirtySequences[lampId] = prepared.nextDirtySequence;
      this.dirtyHead = prepared.nextDirtyHead;
      this.dirtyCount = prepared.nextDirtyCount;
      this.dirtyPeak = prepared.nextDirtyPeak;
      this.dirtySequence = prepared.nextNextDirtySequence;
    }
  }

  getLampShadowGap(lampId: number): number {
    if (!this.isLampActive(lampId)) {
      return 0;
    }

    return this.shadowGaps[lampId] ?? 0;
  }

  getLampGroupId(lampId: number): number {
    if (!this.isLampActive(lampId)) {
      return M4_LAMP_NONE;
    }

    return this.groupIds[lampId] ?? M4_LAMP_NONE;
  }

  getLampRoomId(lampId: number): number {
    if (!this.isLampActive(lampId)) {
      return M4_LAMP_NONE;
    }

    return this.roomIds[lampId] ?? M4_LAMP_NONE;
  }

  getLampVersion(lampId: number): number {
    if (!this.isLampActive(lampId)) {
      return 0;
    }

    return this.lampVersions[lampId] ?? 0;
  }

  isLampActive(lampId: number): boolean {
    return isIndexInRange(lampId, this.lampCapacity) && (this.active[lampId] ?? 0) === 1;
  }

  processDirtyLamps(budget: number, output: M4LampDirtyKeyOutput[]): M4LampDirtyDrainResult {
    if (!isNonNegativeSafeInteger(budget)) {
      return { ok: false, reason: "lamp_dirty_budget_invalid" };
    }

    if (output.length < budget) {
      return { ok: false, reason: "lamp_dirty_output_too_small" };
    }

    let processed = 0;
    while (processed < budget && this.dirtyCount > 0) {
      const lampId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyCapacity;
      this.dirtyCount -= 1;
      this.dirtyQueued[lampId] = 0;

      if (this.isLampActive(lampId)) {
        this.writeDirtyKey(lampId, output[processed]);
        processed += 1;
      }
    }

    this.dirtyDrainCount += 1;
    this.dirtyDrainedKeyCount += processed;
    this.lastDrainProcessedCount = processed;
    this.normalTickVisitedLampCount = processed;
    this.normalTickVisitedCellCount = processed;
    return {
      ok: true,
      processedCount: processed,
      remainingCount: this.dirtyCount,
      budget,
      ownerVersion: this.ownerVersionValue,
    };
  }

  createVisualProjection(maxRows = this.lampCapacity): M4LampVisualProjection {
    const rows: M4LampVisualProjectionRow[] = [];
    const limit = Math.min(maxRows, this.lampCapacity);

    for (let lampId = 0; lampId < this.lampCapacity && rows.length < limit; lampId += 1) {
      if ((this.active[lampId] ?? 0) === 1) {
        rows.push({
          lampId,
          groupId: this.groupIds[lampId] ?? 0,
          cellIndex: this.cellIndexes[lampId] ?? 0,
          roomId: this.roomIds[lampId] ?? 0,
          chunkIndex: this.chunkIndexes[lampId] ?? 0,
          visualLight: calculateVisualLight(
            this.fuels[lampId] ?? 0,
            this.wicks[lampId] ?? 0,
            this.damages[lampId] ?? 0,
            this.humanClaims[lampId] ?? 0,
          ),
          basisLampVersion: this.lampVersions[lampId] ?? 0,
        });
      }
    }

    return {
      readOnly: true,
      basisOwnerVersion: this.ownerVersionValue,
      rowCount: rows.length,
      rows,
    };
  }

  validateProjectionBasis(projection: M4LampVisualProjection): M4LampMutationResult {
    if (projection.basisOwnerVersion !== this.ownerVersionValue) {
      return { ok: false, reason: "lamp_projection_stale_basis" };
    }

    return {
      ok: true,
      lampId: M4_LAMP_NONE,
      groupId: M4_LAMP_NONE,
      changed: false,
      ownerVersion: this.ownerVersionValue,
      lampVersion: 0,
      reason: "lamp.maintenance_changed",
    };
  }

  rejectVisualProjectionMutation(): M4LampMutationResult {
    return { ok: false, reason: "lamp_projection_read_only" };
  }

  createMetrics(): M4LampNetworkMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeLampCount: this.activeLampCountValue,
      activeGroupCount: this.activeGroupCountValue,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      dirtyDrainCount: this.dirtyDrainCount,
      dirtyDrainedKeyCount: this.dirtyDrainedKeyCount,
      lastDrainProcessedCount: this.lastDrainProcessedCount,
      normalTickVisitedLampCount: this.normalTickVisitedLampCount,
      normalTickVisitedCellCount: this.normalTickVisitedCellCount,
      fullMapDiffusionCount: this.fullMapDiffusionCount,
    };
  }

  createSnapshot(): M4LampNetworkSnapshot {
    return {
      version: M4_LAMP_NETWORK_SNAPSHOT_VERSION,
      ownerVersion: this.ownerVersionValue,
      activeLampCount: this.activeLampCountValue,
      activeGroupCount: this.activeGroupCountValue,
      lampCapacity: this.lampCapacity,
      groupCapacity: this.groupCapacity,
      dirtyCapacity: this.dirtyCapacity,
      active: new Uint8Array(this.active),
      groupActive: new Uint8Array(this.groupActive),
      groupLampCounts: new Uint32Array(this.groupLampCounts),
      groupVersions: new Uint32Array(this.groupVersions),
      groupIds: new Uint32Array(this.groupIds),
      cellIndexes: new Uint32Array(this.cellIndexes),
      roomIds: new Uint32Array(this.roomIds),
      chunkIndexes: new Uint32Array(this.chunkIndexes),
      tagMasks: new Uint32Array(this.tagMasks),
      fuels: new Uint32Array(this.fuels),
      wicks: new Uint32Array(this.wicks),
      damages: new Uint32Array(this.damages),
      maintenanceStates: new Uint8Array(this.maintenanceStates),
      humanClaims: new Uint32Array(this.humanClaims),
      shadowGaps: new Uint32Array(this.shadowGaps),
      lampVersions: new Uint32Array(this.lampVersions),
      dirtyQueued: new Uint8Array(this.dirtyQueued),
      dirtyQueue: new Uint32Array(this.dirtyQueue),
      dirtyReasons: new Uint8Array(this.dirtyReasons),
      dirtySequences: new Uint32Array(this.dirtySequences),
      dirtyHead: this.dirtyHead,
      dirtyCount: this.dirtyCount,
      nextDirtySequence: this.dirtySequence,
    };
  }

  private validateRegisterInput(input: M4LampRegisterInput): M4LampMutationResult {
    if (!isIndexInRange(input.lampId, this.lampCapacity)) {
      return { ok: false, reason: "lamp_id_out_of_range" };
    }

    if (!isIndexInRange(input.groupId, this.groupCapacity)) {
      return { ok: false, reason: "lamp_group_out_of_range" };
    }

    if ((this.groupActive[input.groupId] ?? 0) === 0) {
      return { ok: false, reason: "lamp_group_not_registered" };
    }

    if (!isUint32(input.cellIndex) || !isUint32(input.roomId) || !isUint32(input.chunkIndex)) {
      return { ok: false, reason: "lamp_cell_out_of_range" };
    }

    if (
      !isUint32(input.fuel) ||
      !isUint32(input.wick) ||
      !isUint32(input.damage) ||
      !isUint32(input.humanClaim) ||
      !isUint32(input.shadowGap) ||
      !isMaintenanceState(input.maintenanceState) ||
      !isTagMask(input.tagMask)
    ) {
      return { ok: false, reason: "lamp_value_out_of_range" };
    }

    return {
      ok: true,
      lampId: input.lampId,
      groupId: input.groupId,
      changed: false,
      ownerVersion: this.ownerVersionValue,
      lampVersion: 0,
      reason: "lamp.registered",
    };
  }

  private validateRuleUpdate(update: M4LampRuleFieldUpdate): boolean {
    return (
      isLampChangeReason(update.reason) &&
      isOptionalUint32(update.fuel) &&
      isOptionalUint32(update.wick) &&
      isOptionalUint32(update.damage) &&
      isOptionalUint32(update.humanClaim) &&
      isOptionalUint32(update.shadowGap) &&
      (update.maintenanceState === undefined || isMaintenanceState(update.maintenanceState)) &&
      (update.groupId === undefined ||
        (isIndexInRange(update.groupId, this.groupCapacity) &&
          (this.groupActive[update.groupId] ?? 0) === 1))
    );
  }

  private wouldRuleUpdateChange(update: M4LampRuleFieldUpdate): boolean {
    return (
      (update.groupId !== undefined && update.groupId !== (this.groupIds[update.lampId] ?? 0)) ||
      wouldSetUint32(this.fuels, update.lampId, update.fuel) ||
      wouldSetUint32(this.wicks, update.lampId, update.wick) ||
      wouldSetUint32(this.damages, update.lampId, update.damage) ||
      wouldSetUint8(this.maintenanceStates, update.lampId, update.maintenanceState) ||
      wouldSetUint32(this.humanClaims, update.lampId, update.humanClaim) ||
      wouldSetUint32(this.shadowGaps, update.lampId, update.shadowGap)
    );
  }

  private changeLampGroup(lampId: number, nextGroupId: number, version: number): void {
    const previousGroupId = this.groupIds[lampId] ?? M4_LAMP_NONE;
    if (isIndexInRange(previousGroupId, this.groupCapacity)) {
      this.groupLampCounts[previousGroupId] = (this.groupLampCounts[previousGroupId] ?? 1) - 1;
      this.groupVersions[previousGroupId] = version;
    }

    this.groupLampCounts[nextGroupId] = (this.groupLampCounts[nextGroupId] ?? 0) + 1;
    this.groupVersions[nextGroupId] = version;
    this.groupIds[lampId] = nextGroupId;
  }

  private createMutation(
    lampId: number,
    changed: boolean,
    reason: M4LampChangeReason,
  ): M4LampMutationResult {
    return {
      ok: true,
      lampId,
      groupId: this.groupIds[lampId] ?? M4_LAMP_NONE,
      changed,
      ownerVersion: this.ownerVersionValue,
      lampVersion: this.lampVersions[lampId] ?? 0,
      reason,
    };
  }

  private writeDirtyKey(lampId: number, output: M4LampDirtyKeyOutput | undefined): void {
    if (output === undefined) {
      return;
    }

    output.sequence = this.dirtySequences[lampId] ?? 0;
    output.lampId = lampId;
    output.groupId = this.groupIds[lampId] ?? 0;
    output.cellIndex = this.cellIndexes[lampId] ?? 0;
    output.roomId = this.roomIds[lampId] ?? 0;
    output.chunkIndex = this.chunkIndexes[lampId] ?? 0;
    output.projectionKey = lampId + 1;
    output.lampVersion = this.lampVersions[lampId] ?? 0;
    output.ownerVersion = this.ownerVersionValue;
    output.reason = decodeLampChangeReason(this.dirtyReasons[lampId] ?? 0);
  }

  private readActiveLamp(lampId: number): M4LampView {
    return {
      lampId,
      groupId: this.groupIds[lampId] ?? 0,
      cellIndex: this.cellIndexes[lampId] ?? 0,
      roomId: this.roomIds[lampId] ?? 0,
      chunkIndex: this.chunkIndexes[lampId] ?? 0,
      tagMask: this.tagMasks[lampId] ?? 0,
      fuel: this.fuels[lampId] ?? 0,
      wick: this.wicks[lampId] ?? 0,
      damage: this.damages[lampId] ?? 0,
      maintenanceState: decodeMaintenanceState(this.maintenanceStates[lampId] ?? 0),
      humanClaim: this.humanClaims[lampId] ?? 0,
      shadowGap: this.shadowGaps[lampId] ?? 0,
      lampVersion: this.lampVersions[lampId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  private commitLampDirty(lampId: number, reason: M4LampChangeReason): void {
    if ((this.dirtyQueued[lampId] ?? 0) === 1) {
      this.dirtyReasons[lampId] = encodeLampChangeReason(reason);
      return;
    }

    const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyCapacity;
    this.dirtyQueue[tail] = lampId;
    this.dirtyQueued[lampId] = 1;
    this.dirtyReasons[lampId] = encodeLampChangeReason(reason);
    this.dirtySequences[lampId] = this.dirtySequence;
    this.dirtyCount += 1;
    if (this.dirtyCount > this.dirtyPeak) {
      this.dirtyPeak = this.dirtyCount;
    }

    this.dirtySequence += 1;
  }

  private canAdvanceVersion(): boolean {
    return this.ownerVersionValue < 0xffff_ffff;
  }

  private advanceVersion(): number {
    if (this.ownerVersionValue >= 0xffff_ffff) {
      throw new Error("lamp network owner version exhausted");
    }

    this.ownerVersionValue += 1;
    return this.ownerVersionValue;
  }
}

export function createM4LampNetworkStore(options: M4LampNetworkStoreOptions): M4LampNetworkStore {
  return new M4LampNetworkStore(options);
}

export function commitPreparedM4LampMutation(
  store: M4LampNetworkStore,
  prepared: PreparedM4LampMutation,
): void {
  store[M4_LAMP_COMMIT](prepared);
}

export function createM4LampNetworkHashFields(
  snapshot: M4LampNetworkSnapshot,
  prefix = "lamp",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.version },
    { name: `${prefix}.lampCapacity`, value: snapshot.lampCapacity },
    { name: `${prefix}.groupCapacity`, value: snapshot.groupCapacity },
    { name: `${prefix}.dirtyCapacity`, value: snapshot.dirtyCapacity },
    { name: `${prefix}.ownerVersion`, value: snapshot.ownerVersion },
    { name: `${prefix}.activeLampCount`, value: snapshot.activeLampCount },
    { name: `${prefix}.activeGroupCount`, value: snapshot.activeGroupCount },
    { name: `${prefix}.dirtyHead`, value: snapshot.dirtyHead },
    { name: `${prefix}.dirtyCount`, value: snapshot.dirtyCount },
    { name: `${prefix}.nextDirtySequence`, value: snapshot.nextDirtySequence },
  ];
  for (let groupId = 0; groupId < snapshot.groupCapacity; groupId += 1) {
    const groupPrefix = `${prefix}.group.${String(groupId)}`;
    fields.push({ name: `${groupPrefix}.active`, value: snapshot.groupActive[groupId] ?? 0 });
    fields.push({
      name: `${groupPrefix}.lampCount`,
      value: snapshot.groupLampCounts[groupId] ?? 0,
    });
    fields.push({ name: `${groupPrefix}.version`, value: snapshot.groupVersions[groupId] ?? 0 });
  }
  for (let lampId = 0; lampId < snapshot.lampCapacity; lampId += 1) {
    appendM4LampHashRow(fields, snapshot, prefix, lampId);
  }
  for (let queueIndex = 0; queueIndex < snapshot.dirtyCapacity; queueIndex += 1) {
    fields.push({
      name: `${prefix}.dirtyQueue.${String(queueIndex)}`,
      value: snapshot.dirtyQueue[queueIndex] ?? 0,
    });
  }
  return fields;
}

function appendM4LampHashRow(
  fields: CanonicalWorldField[],
  snapshot: M4LampNetworkSnapshot,
  prefix: string,
  lampId: number,
): void {
  const row = `${prefix}.lamp.${String(lampId)}`;
  fields.push({ name: `${row}.active`, value: snapshot.active[lampId] ?? 0 });
  fields.push({ name: `${row}.groupId`, value: snapshot.groupIds[lampId] ?? 0 });
  fields.push({ name: `${row}.cellIndex`, value: snapshot.cellIndexes[lampId] ?? 0 });
  fields.push({ name: `${row}.roomId`, value: snapshot.roomIds[lampId] ?? 0 });
  fields.push({ name: `${row}.chunkIndex`, value: snapshot.chunkIndexes[lampId] ?? 0 });
  fields.push({ name: `${row}.tagMask`, value: snapshot.tagMasks[lampId] ?? 0 });
  fields.push({ name: `${row}.fuel`, value: snapshot.fuels[lampId] ?? 0 });
  fields.push({ name: `${row}.wick`, value: snapshot.wicks[lampId] ?? 0 });
  fields.push({ name: `${row}.damage`, value: snapshot.damages[lampId] ?? 0 });
  fields.push({ name: `${row}.maintenance`, value: snapshot.maintenanceStates[lampId] ?? 0 });
  fields.push({ name: `${row}.humanClaim`, value: snapshot.humanClaims[lampId] ?? 0 });
  fields.push({ name: `${row}.shadowGap`, value: snapshot.shadowGaps[lampId] ?? 0 });
  fields.push({ name: `${row}.version`, value: snapshot.lampVersions[lampId] ?? 0 });
  fields.push({ name: `${row}.dirtyQueued`, value: snapshot.dirtyQueued[lampId] ?? 0 });
  fields.push({ name: `${row}.dirtyReason`, value: snapshot.dirtyReasons[lampId] ?? 0 });
  fields.push({ name: `${row}.dirtySequence`, value: snapshot.dirtySequences[lampId] ?? 0 });
}

function writePreparedLamp(
  input: M4LampPrepareInput,
  groupId: number,
  dirtyReasonCode: number,
  dirtyQueued: boolean,
  changed: boolean,
  ownerVersion: number,
  dirtyCapacity: number,
  dirtyHead: number,
  dirtyCount: number,
  nextDirtySequence: number,
  dirtyPeak: number,
  output: PreparedM4LampMutation,
): void {
  const dirtyMode: M4LampDirtyMode = changed ? (dirtyQueued ? "coalesce" : "append") : "none";
  const nextOwnerVersion = changed ? ownerVersion + 1 : ownerVersion;
  output.ok = true;
  output.lampId = input.lampId;
  output.groupId = groupId;
  output.changed = changed;
  output.operationReasonCode = encodeLampChangeReason(input.reason);
  output.previousFuel = input.expectedFuel;
  output.nextFuel = input.nextFuel;
  output.previousWick = input.expectedWick;
  output.nextWick = input.nextWick;
  output.previousDamage = input.expectedDamage;
  output.nextDamage = input.nextDamage;
  output.previousMaintenanceState = input.expectedMaintenanceState;
  output.nextMaintenanceState = input.nextMaintenanceState;
  output.previousOwnerVersion = ownerVersion;
  output.nextOwnerVersion = nextOwnerVersion;
  output.previousLampVersion = input.expectedLampVersion;
  output.nextLampVersion = changed ? nextOwnerVersion : input.expectedLampVersion;
  output.previousGroupVersion = input.expectedGroupVersion;
  output.nextGroupVersion = changed ? nextOwnerVersion : input.expectedGroupVersion;
  output.previousDirtyQueued = dirtyQueued;
  output.nextDirtyQueued = changed || dirtyQueued;
  output.previousDirtyReasonCode = dirtyReasonCode;
  output.nextDirtyReasonCode = changed ? output.operationReasonCode : dirtyReasonCode;
  output.previousDirtySequence = input.expectedDirtySequence;
  output.nextDirtySequence =
    dirtyMode === "append" ? nextDirtySequence : input.expectedDirtySequence;
  output.previousDirtyHead = dirtyHead;
  output.nextDirtyHead = dirtyHead;
  output.previousDirtyCount = dirtyCount;
  output.nextDirtyCount = dirtyMode === "append" ? dirtyCount + 1 : dirtyCount;
  output.previousDirtyCapacity = dirtyCapacity;
  output.nextDirtyCapacity = dirtyCapacity;
  output.previousNextDirtySequence = nextDirtySequence;
  output.nextNextDirtySequence = dirtyMode === "append" ? nextDirtySequence + 1 : nextDirtySequence;
  output.dirtyMode = dirtyMode;
  output.appendTail = dirtyMode === "append" ? (dirtyHead + dirtyCount) % dirtyCapacity : 0;
  output.nextDirtyPeak = Math.max(dirtyPeak, output.nextDirtyCount);
}

function canAdvancePreparedLampVersions(
  ownerVersion: number,
  lampVersion: number,
  groupVersion: number,
): boolean {
  if (!canAdvanceUint32(ownerVersion)) return false;
  const nextOwnerVersion = ownerVersion + 1;
  return lampVersion < nextOwnerVersion && groupVersion < nextOwnerVersion;
}

function canAdvanceUint32(value: number): boolean {
  return value < 0xffff_ffff;
}

function resetLampInto(
  ownerVersion: number,
  dirtyCapacity: number,
  dirtyHead: number,
  dirtyCount: number,
  nextDirtySequence: number,
  output: M4LampIntoOutput,
): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.lampId = M4_LAMP_NONE;
  output.groupId = M4_LAMP_NONE;
  output.cellIndex = M4_LAMP_NONE;
  output.roomId = M4_LAMP_NONE;
  output.chunkIndex = M4_LAMP_NONE;
  output.tagMask = 0;
  output.fuel = 0;
  output.wick = 0;
  output.damage = 0;
  output.maintenanceState = M4_LAMP_MAINTENANCE_OK;
  output.humanClaim = 0;
  output.shadowGap = 0;
  output.lampVersion = 0;
  output.ownerVersion = ownerVersion;
  output.groupVersion = 0;
  output.dirtyQueued = false;
  output.dirtyReason = "lamp.registered";
  output.dirtySequence = 0;
  output.dirtyCapacity = dirtyCapacity;
  output.dirtyHead = dirtyHead;
  output.dirtyCount = dirtyCount;
  output.nextDirtySequence = nextDirtySequence;
}

function resetPreparedLamp(output: PreparedM4LampMutation): void {
  output.ok = false;
  output.reason = undefined;
  output.lampId = M4_LAMP_NONE;
  output.groupId = M4_LAMP_NONE;
  output.changed = false;
  output.operationReasonCode = 0;
  output.previousFuel = 0;
  output.nextFuel = 0;
  output.previousWick = 0;
  output.nextWick = 0;
  output.previousDamage = 0;
  output.nextDamage = 0;
  output.previousMaintenanceState = M4_LAMP_MAINTENANCE_OK;
  output.nextMaintenanceState = M4_LAMP_MAINTENANCE_OK;
  output.previousOwnerVersion = 0;
  output.nextOwnerVersion = 0;
  output.previousLampVersion = 0;
  output.nextLampVersion = 0;
  output.previousGroupVersion = 0;
  output.nextGroupVersion = 0;
  output.previousDirtyQueued = false;
  output.nextDirtyQueued = false;
  output.previousDirtyReasonCode = 0;
  output.nextDirtyReasonCode = 0;
  output.previousDirtySequence = 0;
  output.nextDirtySequence = 0;
  output.previousDirtyHead = 0;
  output.nextDirtyHead = 0;
  output.previousDirtyCount = 0;
  output.nextDirtyCount = 0;
  output.previousDirtyCapacity = 0;
  output.nextDirtyCapacity = 0;
  output.previousNextDirtySequence = 0;
  output.nextNextDirtySequence = 0;
  output.dirtyMode = "none";
  output.appendTail = 0;
  output.nextDirtyPeak = 0;
}

function isValidLampPrepareScalars(input: M4LampPrepareInput): boolean {
  return (
    isUint32(input.expectedOwnerVersion) &&
    isUint32(input.expectedLampVersion) &&
    isUint32(input.expectedGroupVersion) &&
    isUint32(input.expectedFuel) &&
    isUint32(input.expectedWick) &&
    isUint32(input.expectedDamage) &&
    isMaintenanceState(input.expectedMaintenanceState) &&
    typeof input.expectedDirtyQueued === "boolean" &&
    isLampChangeReason(input.expectedDirtyReason) &&
    isUint32(input.expectedDirtySequence) &&
    isUint32(input.expectedDirtyCapacity) &&
    input.expectedDirtyCapacity > 0 &&
    isUint32(input.expectedDirtyHead) &&
    input.expectedDirtyHead < input.expectedDirtyCapacity &&
    isUint32(input.expectedDirtyCount) &&
    input.expectedDirtyCount <= input.expectedDirtyCapacity &&
    isUint32(input.expectedNextDirtySequence) &&
    isUint32(input.nextFuel) &&
    isUint32(input.nextWick) &&
    isUint32(input.nextDamage) &&
    isMaintenanceState(input.nextMaintenanceState) &&
    isLampOperationReason(input.reason)
  );
}

function hasValidLampDirection(input: M4LampPrepareInput): boolean {
  return (
    input.nextFuel >= input.expectedFuel &&
    input.nextWick >= input.expectedWick &&
    input.nextDamage <= input.expectedDamage
  );
}

function hasPreparedLampChange(input: M4LampPrepareInput): boolean {
  return (
    input.nextFuel !== input.expectedFuel ||
    input.nextWick !== input.expectedWick ||
    input.nextDamage !== input.expectedDamage ||
    input.nextMaintenanceState !== input.expectedMaintenanceState
  );
}

function hasPrimaryLampChange(input: M4LampPrepareInput): boolean {
  if (input.reason === "lamp.fuel_changed") return input.nextFuel !== input.expectedFuel;
  if (input.reason === "lamp.wick_changed") return input.nextWick !== input.expectedWick;
  if (input.reason === "lamp.damage_changed") return input.nextDamage !== input.expectedDamage;
  return input.nextMaintenanceState !== input.expectedMaintenanceState;
}

function isLampOperationReason(reason: unknown): reason is M4LampOperationReason {
  return (
    reason === "lamp.maintenance_changed" ||
    reason === "lamp.fuel_changed" ||
    reason === "lamp.wick_changed" ||
    reason === "lamp.damage_changed"
  );
}

function isLampChangeReason(reason: unknown): reason is M4LampChangeReason {
  return (
    isLampOperationReason(reason) ||
    reason === "lamp.registered" ||
    reason === "lamp.human_claim_changed" ||
    reason === "lamp.shadow_gap_changed" ||
    reason === "lamp.group_changed"
  );
}

function calculateVisualLight(
  fuel: number,
  wick: number,
  damage: number,
  humanClaim: number,
): number {
  const undamaged = damage >= 1_000 ? 0 : 1_000 - damage;
  return Math.floor((Math.min(fuel, wick, humanClaim) * undamaged) / 1_000);
}

function setUint32(lane: Uint32Array, index: number, value: number | undefined): boolean {
  return setNumeric(lane, index, value);
}

function setUint8(lane: Uint8Array, index: number, value: number | undefined): boolean {
  return setNumeric(lane, index, value);
}

function setNumeric(lane: NumericLane, index: number, value: number | undefined): boolean {
  if (value === undefined || lane[index] === value) {
    return false;
  }

  lane[index] = value;
  return true;
}

function wouldSetUint32(lane: Uint32Array, index: number, value: number | undefined): boolean {
  return value !== undefined && lane[index] !== value;
}

function wouldSetUint8(lane: Uint8Array, index: number, value: number | undefined): boolean {
  return value !== undefined && lane[index] !== value;
}

function isMaintenanceState(value: number): value is M4LampMaintenanceState {
  return (
    value === M4_LAMP_MAINTENANCE_OK ||
    value === M4_LAMP_MAINTENANCE_NEEDS_FUEL ||
    value === M4_LAMP_MAINTENANCE_NEEDS_WICK ||
    value === M4_LAMP_MAINTENANCE_DAMAGED
  );
}

function decodeMaintenanceState(value: number): M4LampMaintenanceState {
  if (isMaintenanceState(value)) {
    return value;
  }

  return M4_LAMP_MAINTENANCE_OK;
}

function isTagMask(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= M4_LAMP_TAG_MASK;
}

function isOptionalUint32(value: number | undefined): boolean {
  return value === undefined || isUint32(value);
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function requirePositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

function encodeLampChangeReason(reason: M4LampChangeReason): number {
  if (reason === "lamp.maintenance_changed") {
    return 1;
  }

  if (reason === "lamp.fuel_changed") {
    return 2;
  }

  if (reason === "lamp.wick_changed") {
    return 3;
  }

  if (reason === "lamp.damage_changed") {
    return 4;
  }

  if (reason === "lamp.human_claim_changed") {
    return 5;
  }

  if (reason === "lamp.shadow_gap_changed") {
    return 6;
  }

  if (reason === "lamp.group_changed") {
    return 7;
  }

  return 0;
}

function decodeLampChangeReason(code: number): M4LampChangeReason {
  if (code === 1) {
    return "lamp.maintenance_changed";
  }

  if (code === 2) {
    return "lamp.fuel_changed";
  }

  if (code === 3) {
    return "lamp.wick_changed";
  }

  if (code === 4) {
    return "lamp.damage_changed";
  }

  if (code === 5) {
    return "lamp.human_claim_changed";
  }

  if (code === 6) {
    return "lamp.shadow_gap_changed";
  }

  if (code === 7) {
    return "lamp.group_changed";
  }

  return "lamp.registered";
}
