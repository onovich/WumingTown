import { mixUint32 } from "./deterministic-hash";
import { assertValidCapacity } from "./entity-id";

export const M3_HEALTH_SNAPSHOT_VERSION = 1;
export const M3_ABILITY_LANE_COUNT = 6;
export const M3_ABILITY_CONSCIOUSNESS = 0;
export const M3_ABILITY_MOVEMENT = 1;
export const M3_ABILITY_MANIPULATION = 2;
export const M3_ABILITY_SIGHT = 3;
export const M3_ABILITY_COMMUNICATION = 4;
export const M3_ABILITY_STAMINA = 5;
export const M3_HEALTH_CONDITION_KIND_INJURY = 1;
export const M3_HEALTH_CONDITION_KIND_ILLNESS = 2;
export const M3_HEALTH_CONDITION_ACTIVE = 0;
export const M3_HEALTH_CONDITION_RECOVERING = 1;
export const M3_HEALTH_CONDITION_RESOLVED = 2;
export const M3_HEALTH_CONDITION_REMOVED = 3;

export type M3AbilityReason =
  | "ability.cache_invalidated"
  | "ability.cache_hit"
  | "ability.cache_rebuilt"
  | "ability.cache_stale_basis"
  | "ability.rejected_below_threshold"
  | "ability.actor_out_of_range"
  | "ability.lane_out_of_range"
  | "ability.value_out_of_range"
  | "ability.dirty_queue_overflow";

export type M3HealthConditionReason =
  | "condition.injury_applied"
  | "condition.illness_applied"
  | "condition.updated"
  | "condition.aged"
  | "condition.removed"
  | "condition.id_out_of_range"
  | "condition.already_active"
  | "condition.not_active"
  | "condition.actor_out_of_range"
  | "condition.kind_out_of_range"
  | "condition.body_part_out_of_range"
  | "condition.severity_out_of_range"
  | "condition.age_out_of_range"
  | "condition.source_out_of_range"
  | "condition.terminal_state_out_of_range"
  | "condition.ability_mask_empty"
  | "condition.dirty_queue_overflow";

export interface M3HealthConditionInput {
  readonly conditionId: number;
  readonly actorId: number;
  readonly defId: number;
  readonly kind: number;
  readonly bodyPart: number;
  readonly severity: number;
  readonly ageTicks: number;
  readonly sourceId: number;
  readonly componentFlags: number;
  readonly clueRef: number;
  readonly counterevidenceRef: number;
  readonly terminalState: number;
  readonly affectedAbilityMask: number;
}

export interface M3HealthConditionUpdateInput {
  readonly conditionId: number;
  readonly severity?: number;
  readonly ageTicks?: number;
  readonly sourceId?: number;
  readonly componentFlags?: number;
  readonly clueRef?: number;
  readonly counterevidenceRef?: number;
  readonly terminalState?: number;
  readonly affectedAbilityMask?: number;
}

export interface M3HealthConditionView extends M3HealthConditionInput {
  readonly actorConditionVersion: number;
  readonly conditionVersion: number;
}

export interface M3HealthConditionIntoOutput {
  ok: boolean;
  conditionId: number;
  actorId: number;
  defId: number;
  kind: number;
  bodyPart: number;
  severity: number;
  ageTicks: number;
  sourceId: number;
  componentFlags: number;
  clueRef: number;
  counterevidenceRef: number;
  terminalState: number;
  affectedAbilityMask: number;
  storeVersion: number;
  conditionVersion: number;
  actorConditionVersion: number;
  updateCount: number;
  invalidationCount: number;
  dirtyWriteCursor: number;
  dirtyCount: number;
  dirtyPeak: number;
  dirtyCapacity: number;
}

export interface M3HealthTreatmentConditionDeltaPrepareInput {
  readonly conditionId: number;
  readonly expectedActorId: number;
  readonly expectedDefId: number;
  readonly expectedSeverity: number;
  readonly expectedTerminalState: number;
  readonly expectedAffectedAbilityMask: number;
  readonly expectedStoreVersion: number;
  readonly expectedConditionVersion: number;
  readonly expectedActorConditionVersion: number;
  readonly severityDelta: number;
}

export type M3HealthTreatmentPrepareReason =
  | "condition.treatment_prepared"
  | "condition.id_out_of_range"
  | "condition.not_active"
  | "condition.identity_stale"
  | "condition.value_stale"
  | "condition.version_stale"
  | "condition.severity_out_of_range"
  | "condition.terminal_state_out_of_range"
  | "condition.version_exhausted"
  | "condition.counter_exhausted"
  | "condition.dirty_queue_overflow";

export interface PreparedM3HealthTreatmentConditionDelta {
  ok: boolean;
  reason: M3HealthTreatmentPrepareReason;
  conditionId: number;
  actorId: number;
  abilityMask: number;
  previousSeverity: number;
  nextSeverity: number;
  previousTerminalState: number;
  nextTerminalState: number;
  previousStoreVersion: number;
  nextStoreVersion: number;
  previousConditionVersion: number;
  nextConditionVersion: number;
  previousActorConditionVersion: number;
  nextActorConditionVersion: number;
  previousUpdateCount: number;
  nextUpdateCount: number;
  previousInvalidationCount: number;
  nextInvalidationCount: number;
  previousDirtyWriteCursor: number;
  nextDirtyWriteCursor: number;
  previousDirtyCount: number;
  nextDirtyCount: number;
  previousDirtyPeak: number;
  nextDirtyPeak: number;
  invalidationWriteCount: number;
}

export type M3HealthConditionMutationResult =
  | {
      readonly ok: true;
      readonly reason: M3HealthConditionReason;
      readonly actorId: number;
      readonly actorConditionVersion: number;
      readonly storeVersion: number;
    }
  | {
      readonly ok: false;
      readonly reason: M3HealthConditionReason;
    };

export type M3AbilityQueryResult =
  | {
      readonly ok: true;
      readonly reason: "ability.cache_rebuilt" | "ability.cache_hit";
      readonly actorId: number;
      readonly ability: number;
      readonly value: number;
      readonly baseValue: number;
      readonly conditionPenalty: number;
      readonly actorConditionVersion: number;
      readonly baseAbilityVersion: number;
      readonly visitedConditionCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: M3AbilityReason;
      readonly actorId: number;
      readonly ability: number;
      readonly value: number;
      readonly threshold: number;
      readonly actorConditionVersion: number;
      readonly baseAbilityVersion: number;
      readonly visitedConditionCount: number;
    };

export interface M3AbilityPenaltyIntoOutput {
  penalty: number;
  visited: number;
}

export interface M3AbilityQueryIntoOutput {
  ok: boolean;
  reason: M3AbilityReason;
  actorId: number;
  ability: number;
  value: number;
  threshold: number;
  baseValue: number;
  conditionPenalty: number;
  actorConditionVersion: number;
  baseAbilityVersion: number;
  visitedConditionCount: number;
}

export interface M3HealthConditionStoreOptions {
  readonly actorCapacity: number;
  readonly conditionCapacity: number;
  readonly abilityDirtyCapacity: number;
}

export interface M3AbilityCacheStoreOptions {
  readonly actorCapacity: number;
  readonly dirtyCapacity: number;
}

export interface M3HealthMetrics {
  readonly activeConditionCount: number;
  readonly storeVersion: number;
  readonly conditionUpdateCount: number;
  readonly abilityInvalidationCount: number;
  readonly healthDirtyBacklog: number;
  readonly healthDirtyPeak: number;
}

export interface M3AbilityMetrics {
  readonly abilityQueryCount: number;
  readonly abilityCacheHitCount: number;
  readonly abilityCacheRebuildCount: number;
  readonly staleBasisRejectCount: number;
  readonly abilityInvalidationCount: number;
  readonly abilityFailureCount: number;
  readonly conditionRowsVisitedOnRebuild: number;
  readonly abilityDirtyBacklog: number;
  readonly abilityDirtyPeak: number;
}

type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: M3HealthConditionReason };

const M3_HEALTH_TREATMENT_COMMIT = Symbol("m3-health-treatment-commit");
const M3_HEALTH_CONDITION_NONE = 0xffff_ffff;
const UINT32_MAX = 0xffff_ffff;
const UINT32_PREPARE_MAX = 0xffff_fffe;
const ABILITY_INVALIDATION_REASON_CODE = encodeAbilityReason("ability.cache_invalidated");

export class M3HealthConditionStore {
  readonly actorCapacity: number;
  readonly conditionCapacity: number;
  readonly abilityDirtyCapacity: number;

  private readonly active: Uint8Array;
  private readonly actorIds: Uint32Array;
  private readonly defIds: Uint32Array;
  private readonly kinds: Uint8Array;
  private readonly bodyParts: Uint16Array;
  private readonly severities: Uint16Array;
  private readonly ages: Uint32Array;
  private readonly sourceIds: Uint32Array;
  private readonly componentFlags: Uint32Array;
  private readonly clueRefs: Uint32Array;
  private readonly counterevidenceRefs: Uint32Array;
  private readonly terminalStates: Uint8Array;
  private readonly affectedAbilityMasks: Uint8Array;
  private readonly conditionVersions: Uint32Array;
  private readonly actorConditionVersions: Uint32Array;
  private readonly actorHeads: Int32Array;
  private readonly nextByActor: Int32Array;
  private readonly previousByActor: Int32Array;
  private readonly dirtyActors: Uint32Array;
  private readonly dirtyAbilities: Uint8Array;
  private readonly dirtyVersions: Uint32Array;
  private readonly dirtyReasons: Uint8Array;
  private activeCount = 0;
  private version = 0;
  private updateCount = 0;
  private invalidationCount = 0;
  private dirtyReadCursor = 0;
  private dirtyWriteCursor = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;

  constructor(options: M3HealthConditionStoreOptions) {
    assertValidCapacity(options.actorCapacity, "M3 health actor capacity");
    assertValidCapacity(options.conditionCapacity, "M3 health condition capacity");
    assertValidCapacity(options.abilityDirtyCapacity, "M3 health ability dirty capacity");
    this.actorCapacity = options.actorCapacity;
    this.conditionCapacity = options.conditionCapacity;
    this.abilityDirtyCapacity = options.abilityDirtyCapacity;
    this.active = new Uint8Array(options.conditionCapacity);
    this.actorIds = new Uint32Array(options.conditionCapacity);
    this.defIds = new Uint32Array(options.conditionCapacity);
    this.kinds = new Uint8Array(options.conditionCapacity);
    this.bodyParts = new Uint16Array(options.conditionCapacity);
    this.severities = new Uint16Array(options.conditionCapacity);
    this.ages = new Uint32Array(options.conditionCapacity);
    this.sourceIds = new Uint32Array(options.conditionCapacity);
    this.componentFlags = new Uint32Array(options.conditionCapacity);
    this.clueRefs = new Uint32Array(options.conditionCapacity);
    this.counterevidenceRefs = new Uint32Array(options.conditionCapacity);
    this.terminalStates = new Uint8Array(options.conditionCapacity);
    this.affectedAbilityMasks = new Uint8Array(options.conditionCapacity);
    this.conditionVersions = new Uint32Array(options.conditionCapacity);
    this.actorConditionVersions = new Uint32Array(options.actorCapacity);
    this.actorHeads = createEmptyLinks(options.actorCapacity);
    this.nextByActor = createEmptyLinks(options.conditionCapacity);
    this.previousByActor = createEmptyLinks(options.conditionCapacity);
    this.dirtyActors = new Uint32Array(options.abilityDirtyCapacity);
    this.dirtyAbilities = new Uint8Array(options.abilityDirtyCapacity);
    this.dirtyVersions = new Uint32Array(options.abilityDirtyCapacity);
    this.dirtyReasons = new Uint8Array(options.abilityDirtyCapacity);
  }

  get storeVersion(): number {
    return this.version;
  }

  actorConditionVersion(actorId: number): number {
    return isIndexInRange(actorId, this.actorCapacity)
      ? (this.actorConditionVersions[actorId] ?? 0)
      : 0;
  }

  addCondition(input: M3HealthConditionInput): M3HealthConditionMutationResult {
    const validation = this.validateInput(input);
    if (!validation.ok) {
      return validation;
    }
    if (this.active[input.conditionId] === 1) {
      return { ok: false, reason: "condition.already_active" };
    }
    const dirtyCapacity = this.validateDirtyCapacity(input.affectedAbilityMask);
    if (!dirtyCapacity.ok) {
      return dirtyCapacity;
    }
    this.writeCondition(input);
    this.insertActorLink(input.actorId, input.conditionId);
    this.activeCount += 1;
    return this.commitConditionChange(
      input.conditionId,
      input.actorId,
      input.affectedAbilityMask,
      input.kind === M3_HEALTH_CONDITION_KIND_ILLNESS
        ? "condition.illness_applied"
        : "condition.injury_applied",
    );
  }

  updateCondition(input: M3HealthConditionUpdateInput): M3HealthConditionMutationResult {
    if (!isIndexInRange(input.conditionId, this.conditionCapacity)) {
      return { ok: false, reason: "condition.id_out_of_range" };
    }
    if (this.active[input.conditionId] !== 1) {
      return { ok: false, reason: "condition.not_active" };
    }
    const currentMask = this.affectedAbilityMasks[input.conditionId] ?? 0;
    const validation = this.validateUpdate(input);
    if (!validation.ok) {
      return validation;
    }
    const nextMask = "affectedAbilityMask" in input ? input.affectedAbilityMask : currentMask;
    const dirtyCapacity = this.validateDirtyCapacity(currentMask | nextMask);
    if (!dirtyCapacity.ok) {
      return dirtyCapacity;
    }
    if ("severity" in input) {
      this.severities[input.conditionId] = input.severity;
    }
    if ("ageTicks" in input) {
      this.ages[input.conditionId] = input.ageTicks;
    }
    if ("sourceId" in input) {
      this.sourceIds[input.conditionId] = input.sourceId;
    }
    if ("componentFlags" in input) {
      this.componentFlags[input.conditionId] = input.componentFlags;
    }
    if ("clueRef" in input) {
      this.clueRefs[input.conditionId] = input.clueRef;
    }
    if ("counterevidenceRef" in input) {
      this.counterevidenceRefs[input.conditionId] = input.counterevidenceRef;
    }
    if ("terminalState" in input) {
      this.terminalStates[input.conditionId] = input.terminalState;
    }
    if ("affectedAbilityMask" in input) {
      this.affectedAbilityMasks[input.conditionId] = input.affectedAbilityMask;
    }
    const actorId = this.actorIds[input.conditionId] ?? 0;
    return this.commitConditionChange(
      input.conditionId,
      actorId,
      currentMask | nextMask,
      "condition.updated",
    );
  }

  ageCondition(conditionId: number, deltaTicks: number): M3HealthConditionMutationResult {
    if (!isIndexInRange(conditionId, this.conditionCapacity)) {
      return { ok: false, reason: "condition.id_out_of_range" };
    }
    if (this.active[conditionId] !== 1) {
      return { ok: false, reason: "condition.not_active" };
    }
    if (!isNonNegativeUint32(deltaTicks)) {
      return { ok: false, reason: "condition.age_out_of_range" };
    }
    const nextAge = (this.ages[conditionId] ?? 0) + deltaTicks;
    if (!isNonNegativeUint32(nextAge)) {
      return { ok: false, reason: "condition.age_out_of_range" };
    }
    const mask = this.affectedAbilityMasks[conditionId] ?? 0;
    const dirtyCapacity = this.validateDirtyCapacity(mask);
    if (!dirtyCapacity.ok) {
      return dirtyCapacity;
    }
    this.ages[conditionId] = nextAge;
    return this.commitConditionChange(
      conditionId,
      this.actorIds[conditionId] ?? 0,
      mask,
      "condition.aged",
    );
  }

  removeCondition(conditionId: number): M3HealthConditionMutationResult {
    if (!isIndexInRange(conditionId, this.conditionCapacity)) {
      return { ok: false, reason: "condition.id_out_of_range" };
    }
    if (this.active[conditionId] !== 1) {
      return { ok: false, reason: "condition.not_active" };
    }
    const actorId = this.actorIds[conditionId] ?? 0;
    const mask = this.affectedAbilityMasks[conditionId] ?? 0;
    const dirtyCapacity = this.validateDirtyCapacity(mask);
    if (!dirtyCapacity.ok) {
      return dirtyCapacity;
    }
    this.removeActorLink(actorId, conditionId);
    this.active[conditionId] = 0;
    this.terminalStates[conditionId] = M3_HEALTH_CONDITION_REMOVED;
    this.activeCount -= 1;
    return this.commitConditionChange(conditionId, actorId, mask, "condition.removed");
  }

  readCondition(conditionId: number): M3HealthConditionView | undefined {
    if (!isIndexInRange(conditionId, this.conditionCapacity) || this.active[conditionId] !== 1) {
      return undefined;
    }
    const actorId = this.actorIds[conditionId] ?? 0;
    return {
      conditionId,
      actorId,
      defId: this.defIds[conditionId] ?? 0,
      kind: this.kinds[conditionId] ?? 0,
      bodyPart: this.bodyParts[conditionId] ?? 0,
      severity: this.severities[conditionId] ?? 0,
      ageTicks: this.ages[conditionId] ?? 0,
      sourceId: this.sourceIds[conditionId] ?? 0,
      componentFlags: this.componentFlags[conditionId] ?? 0,
      clueRef: this.clueRefs[conditionId] ?? 0,
      counterevidenceRef: this.counterevidenceRefs[conditionId] ?? 0,
      terminalState: this.terminalStates[conditionId] ?? 0,
      affectedAbilityMask: this.affectedAbilityMasks[conditionId] ?? 0,
      actorConditionVersion: this.actorConditionVersions[actorId] ?? 0,
      conditionVersion: this.conditionVersions[conditionId] ?? 0,
    };
  }

  readConditionInto(conditionId: number, output: M3HealthConditionIntoOutput): void {
    resetM3HealthConditionIntoOutput(conditionId, output);
    if (!isIndexInRange(conditionId, this.conditionCapacity) || this.active[conditionId] !== 1) {
      return;
    }
    const actorId = this.actorIds[conditionId] ?? 0;
    output.ok = true;
    output.conditionId = conditionId;
    output.actorId = actorId;
    output.defId = this.defIds[conditionId] ?? 0;
    output.kind = this.kinds[conditionId] ?? 0;
    output.bodyPart = this.bodyParts[conditionId] ?? 0;
    output.severity = this.severities[conditionId] ?? 0;
    output.ageTicks = this.ages[conditionId] ?? 0;
    output.sourceId = this.sourceIds[conditionId] ?? 0;
    output.componentFlags = this.componentFlags[conditionId] ?? 0;
    output.clueRef = this.clueRefs[conditionId] ?? 0;
    output.counterevidenceRef = this.counterevidenceRefs[conditionId] ?? 0;
    output.terminalState = this.terminalStates[conditionId] ?? 0;
    output.affectedAbilityMask = this.affectedAbilityMasks[conditionId] ?? 0;
    output.storeVersion = this.version;
    output.conditionVersion = this.conditionVersions[conditionId] ?? 0;
    output.actorConditionVersion = this.actorConditionVersions[actorId] ?? 0;
    output.updateCount = this.updateCount;
    output.invalidationCount = this.invalidationCount;
    output.dirtyWriteCursor = this.dirtyWriteCursor;
    output.dirtyCount = this.dirtyCount;
    output.dirtyPeak = this.dirtyPeak;
    output.dirtyCapacity = this.abilityDirtyCapacity;
  }

  prepareTreatmentConditionDeltaInto(
    input: M3HealthTreatmentConditionDeltaPrepareInput,
    output: PreparedM3HealthTreatmentConditionDelta,
  ): void {
    resetPreparedM3HealthTreatment(output);
    const conditionId = input.conditionId;
    if (!isIndexInRange(conditionId, this.conditionCapacity))
      return setTreatmentPrepareFailure(output, "condition.id_out_of_range");
    if (this.active[conditionId] !== 1)
      return setTreatmentPrepareFailure(output, "condition.not_active");
    const actorId = this.actorIds[conditionId] ?? 0;
    const abilityMask = this.affectedAbilityMasks[conditionId] ?? 0;
    const previousSeverity = this.severities[conditionId] ?? 0;
    const previousTerminalState = this.terminalStates[conditionId] ?? 0;
    const previousConditionVersion = this.conditionVersions[conditionId] ?? 0;
    const previousActorConditionVersion = this.actorConditionVersions[actorId] ?? 0;
    const invalidationWriteCount = countAbilityMaskLanes(abilityMask);
    const reason = validateTreatmentPrepare(
      input,
      actorId,
      this.defIds[conditionId] ?? 0,
      previousSeverity,
      previousTerminalState,
      abilityMask,
      this.version,
      previousConditionVersion,
      previousActorConditionVersion,
      this.updateCount,
      this.invalidationCount,
      invalidationWriteCount,
      this.dirtyCount,
      this.abilityDirtyCapacity,
    );
    if (reason !== undefined) return setTreatmentPrepareFailure(output, reason);
    writePreparedM3HealthTreatment(
      output,
      conditionId,
      actorId,
      abilityMask,
      previousSeverity,
      input.severityDelta,
      previousTerminalState,
      this.version,
      previousConditionVersion,
      previousActorConditionVersion,
      this.updateCount,
      this.invalidationCount,
      this.dirtyWriteCursor,
      this.dirtyCount,
      this.dirtyPeak,
      this.abilityDirtyCapacity,
      invalidationWriteCount,
    );
  }

  [M3_HEALTH_TREATMENT_COMMIT](prepared: PreparedM3HealthTreatmentConditionDelta): void {
    this.severities[prepared.conditionId] = prepared.nextSeverity;
    this.terminalStates[prepared.conditionId] = prepared.nextTerminalState;
    this.version = prepared.nextStoreVersion;
    this.conditionVersions[prepared.conditionId] = prepared.nextConditionVersion;
    this.actorConditionVersions[prepared.actorId] = prepared.nextActorConditionVersion;
    this.updateCount = prepared.nextUpdateCount;
    this.invalidationCount = prepared.nextInvalidationCount;
    let writeCursor = prepared.previousDirtyWriteCursor;
    for (let ability = 0; ability < M3_ABILITY_LANE_COUNT; ability += 1) {
      if ((prepared.abilityMask & abilityMaskFor(ability)) !== 0) {
        this.dirtyActors[writeCursor] = prepared.actorId;
        this.dirtyAbilities[writeCursor] = ability;
        this.dirtyVersions[writeCursor] = prepared.nextActorConditionVersion;
        this.dirtyReasons[writeCursor] = ABILITY_INVALIDATION_REASON_CODE;
        writeCursor = (writeCursor + 1) % this.abilityDirtyCapacity;
      }
    }
    this.dirtyWriteCursor = prepared.nextDirtyWriteCursor;
    this.dirtyCount = prepared.nextDirtyCount;
    this.dirtyPeak = prepared.nextDirtyPeak;
  }

  computeAbilityPenalty(
    actorId: number,
    ability: number,
  ): { readonly penalty: number; readonly visited: number } {
    if (!isIndexInRange(actorId, this.actorCapacity) || !isAbilityLane(ability)) {
      return { penalty: 0, visited: 0 };
    }
    const abilityMask = abilityMaskFor(ability);
    let current = this.actorHeads[actorId] ?? -1;
    let penalty = 0;
    let visited = 0;
    while (current >= 0) {
      visited += 1;
      const terminalState = this.terminalStates[current] ?? M3_HEALTH_CONDITION_REMOVED;
      if (terminalState <= M3_HEALTH_CONDITION_RECOVERING) {
        const mask = this.affectedAbilityMasks[current] ?? 0;
        if ((mask & abilityMask) !== 0) {
          penalty += this.severities[current] ?? 0;
        }
      }
      current = this.nextByActor[current] ?? -1;
    }
    return { penalty: clampAbilityValue(penalty), visited };
  }

  computeAbilityPenaltyInto(
    actorId: number,
    ability: number,
    output: M3AbilityPenaltyIntoOutput,
  ): void {
    output.penalty = 0;
    output.visited = 0;
    if (!isIndexInRange(actorId, this.actorCapacity) || !isAbilityLane(ability)) return;

    const abilityMask = abilityMaskFor(ability);
    let current = this.actorHeads[actorId] ?? -1;
    let penalty = 0;
    let visited = 0;
    while (current >= 0) {
      visited += 1;
      const terminalState = this.terminalStates[current] ?? M3_HEALTH_CONDITION_REMOVED;
      if (
        terminalState <= M3_HEALTH_CONDITION_RECOVERING &&
        ((this.affectedAbilityMasks[current] ?? 0) & abilityMask) !== 0
      ) {
        penalty += this.severities[current] ?? 0;
      }
      current = this.nextByActor[current] ?? -1;
    }
    output.penalty = clampAbilityValue(penalty);
    output.visited = visited;
  }

  drainAbilityInvalidations(cache: M3AbilityCacheStore, maxCount: number): number {
    if (!isPositiveSafeInteger(maxCount)) {
      return 0;
    }
    let drained = 0;
    while (this.dirtyCount > 0 && drained < maxCount) {
      const slot = this.dirtyReadCursor;
      cache.invalidateConditionAbilityLane(
        this.dirtyActors[slot] ?? 0,
        this.dirtyAbilities[slot] ?? 0,
        this.dirtyVersions[slot] ?? 0,
        decodeAbilityReason(this.dirtyReasons[slot] ?? 0),
      );
      this.dirtyReadCursor = (this.dirtyReadCursor + 1) % this.abilityDirtyCapacity;
      this.dirtyCount -= 1;
      drained += 1;
    }
    return drained;
  }

  createMetrics(): M3HealthMetrics {
    return {
      activeConditionCount: this.activeCount,
      storeVersion: this.version,
      conditionUpdateCount: this.updateCount,
      abilityInvalidationCount: this.invalidationCount,
      healthDirtyBacklog: this.dirtyCount,
      healthDirtyPeak: this.dirtyPeak,
    };
  }

  createHash(): number {
    let hash = mixUint32(0x811c_9dc5, M3_HEALTH_SNAPSHOT_VERSION);
    hash = mixUint32(hash, this.version);
    for (let conditionId = 0; conditionId < this.conditionCapacity; conditionId += 1) {
      if (this.active[conditionId] === 1) {
        hash = mixCondition(hash, conditionId, this);
      }
    }
    return hash;
  }

  private validateInput(input: M3HealthConditionInput): ValidationResult {
    if (!isIndexInRange(input.conditionId, this.conditionCapacity)) {
      return { ok: false, reason: "condition.id_out_of_range" };
    }
    if (!isIndexInRange(input.actorId, this.actorCapacity)) {
      return { ok: false, reason: "condition.actor_out_of_range" };
    }
    if (!isNonNegativeUint32(input.defId)) {
      return { ok: false, reason: "condition.body_part_out_of_range" };
    }
    if (
      input.kind !== M3_HEALTH_CONDITION_KIND_INJURY &&
      input.kind !== M3_HEALTH_CONDITION_KIND_ILLNESS
    ) {
      return { ok: false, reason: "condition.kind_out_of_range" };
    }
    if (!isIndexInRange(input.bodyPart, 0x1_0000)) {
      return { ok: false, reason: "condition.body_part_out_of_range" };
    }
    if (!isSeverity(input.severity)) {
      return { ok: false, reason: "condition.severity_out_of_range" };
    }
    if (!isNonNegativeUint32(input.ageTicks)) {
      return { ok: false, reason: "condition.age_out_of_range" };
    }
    if (!isNonNegativeUint32(input.sourceId)) {
      return { ok: false, reason: "condition.source_out_of_range" };
    }
    if (!isTerminalState(input.terminalState)) {
      return { ok: false, reason: "condition.terminal_state_out_of_range" };
    }
    if ((input.affectedAbilityMask & abilityMaskAll()) === 0) {
      return { ok: false, reason: "condition.ability_mask_empty" };
    }
    return { ok: true };
  }

  private validateUpdate(input: M3HealthConditionUpdateInput): ValidationResult {
    if ("severity" in input && !isSeverity(input.severity)) {
      return { ok: false, reason: "condition.severity_out_of_range" };
    }
    if ("ageTicks" in input && !isNonNegativeUint32(input.ageTicks)) {
      return { ok: false, reason: "condition.age_out_of_range" };
    }
    if ("sourceId" in input && !isNonNegativeUint32(input.sourceId)) {
      return { ok: false, reason: "condition.source_out_of_range" };
    }
    if ("terminalState" in input && !isTerminalState(input.terminalState)) {
      return { ok: false, reason: "condition.terminal_state_out_of_range" };
    }
    if ("affectedAbilityMask" in input && (input.affectedAbilityMask & abilityMaskAll()) === 0) {
      return { ok: false, reason: "condition.ability_mask_empty" };
    }
    return { ok: true };
  }

  private writeCondition(input: M3HealthConditionInput): void {
    this.active[input.conditionId] = 1;
    this.actorIds[input.conditionId] = input.actorId;
    this.defIds[input.conditionId] = input.defId;
    this.kinds[input.conditionId] = input.kind;
    this.bodyParts[input.conditionId] = input.bodyPart;
    this.severities[input.conditionId] = input.severity;
    this.ages[input.conditionId] = input.ageTicks;
    this.sourceIds[input.conditionId] = input.sourceId;
    this.componentFlags[input.conditionId] = input.componentFlags;
    this.clueRefs[input.conditionId] = input.clueRef;
    this.counterevidenceRefs[input.conditionId] = input.counterevidenceRef;
    this.terminalStates[input.conditionId] = input.terminalState;
    this.affectedAbilityMasks[input.conditionId] = input.affectedAbilityMask;
  }

  private commitConditionChange(
    conditionId: number,
    actorId: number,
    abilityMask: number,
    reason: M3HealthConditionReason,
  ): M3HealthConditionMutationResult {
    const dirtyCapacity = this.validateDirtyCapacity(abilityMask);
    if (!dirtyCapacity.ok) {
      return dirtyCapacity;
    }
    this.version += 1;
    this.updateCount += 1;
    this.actorConditionVersions[actorId] = (this.actorConditionVersions[actorId] ?? 0) + 1;
    this.conditionVersions[conditionId] = (this.conditionVersions[conditionId] ?? 0) + 1;
    this.enqueueInvalidations(actorId, abilityMask);
    return {
      ok: true,
      reason,
      actorId,
      actorConditionVersion: this.actorConditionVersions[actorId] ?? 0,
      storeVersion: this.version,
    };
  }

  private enqueueInvalidations(actorId: number, abilityMask: number): boolean {
    for (let ability = 0; ability < M3_ABILITY_LANE_COUNT; ability += 1) {
      if ((abilityMask & abilityMaskFor(ability)) !== 0) {
        if (this.dirtyCount >= this.abilityDirtyCapacity) {
          return false;
        }
        const slot = this.dirtyWriteCursor;
        this.dirtyActors[slot] = actorId;
        this.dirtyAbilities[slot] = ability;
        this.dirtyVersions[slot] = this.actorConditionVersions[actorId] ?? 0;
        this.dirtyReasons[slot] = encodeAbilityReason("ability.cache_invalidated");
        this.dirtyWriteCursor = (this.dirtyWriteCursor + 1) % this.abilityDirtyCapacity;
        this.dirtyCount += 1;
        this.invalidationCount += 1;
        this.dirtyPeak = Math.max(this.dirtyPeak, this.dirtyCount);
      }
    }
    return true;
  }

  private validateDirtyCapacity(abilityMask: number): ValidationResult {
    if (this.dirtyCount + countAbilityMaskLanes(abilityMask) > this.abilityDirtyCapacity) {
      return { ok: false, reason: "condition.dirty_queue_overflow" };
    }
    return { ok: true };
  }

  private insertActorLink(actorId: number, conditionId: number): void {
    let current = this.actorHeads[actorId] ?? -1;
    let previous = -1;
    while (current >= 0 && current < conditionId) {
      previous = current;
      current = this.nextByActor[current] ?? -1;
    }
    this.previousByActor[conditionId] = previous;
    this.nextByActor[conditionId] = current;
    if (previous < 0) {
      this.actorHeads[actorId] = conditionId;
    } else {
      this.nextByActor[previous] = conditionId;
    }
    if (current >= 0) {
      this.previousByActor[current] = conditionId;
    }
  }

  private removeActorLink(actorId: number, conditionId: number): void {
    const previous = this.previousByActor[conditionId] ?? -1;
    const next = this.nextByActor[conditionId] ?? -1;
    if (previous < 0) {
      this.actorHeads[actorId] = next;
    } else {
      this.nextByActor[previous] = next;
    }
    if (next >= 0) {
      this.previousByActor[next] = previous;
    }
    this.previousByActor[conditionId] = -1;
    this.nextByActor[conditionId] = -1;
  }
}

export function commitPreparedM3HealthTreatment(
  store: M3HealthConditionStore,
  prepared: PreparedM3HealthTreatmentConditionDelta,
): void {
  store[M3_HEALTH_TREATMENT_COMMIT](prepared);
}

export class M3AbilityCacheStore {
  readonly actorCapacity: number;
  readonly dirtyCapacity: number;

  private readonly baseValues: Uint16Array;
  private readonly cachedValues: Uint16Array;
  private readonly baseVersions: Uint32Array;
  private readonly sourceConditionVersions: Uint32Array;
  private readonly valid: Uint8Array;
  private readonly dirty: Uint8Array;
  private readonly dirtyActors: Uint32Array;
  private readonly dirtyAbilities: Uint8Array;
  private readonly dirtyReasons: Uint8Array;
  private queryCount = 0;
  private hitCount = 0;
  private rebuildCount = 0;
  private staleRejectCount = 0;
  private invalidationCount = 0;
  private failureCount = 0;
  private visitedRows = 0;
  private dirtyReadCursor = 0;
  private dirtyWriteCursor = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private readonly penaltyIntoOutput: M3AbilityPenaltyIntoOutput;
  private readonly legacyQueryIntoOutput: M3AbilityQueryIntoOutput;

  constructor(options: M3AbilityCacheStoreOptions) {
    assertValidCapacity(options.actorCapacity, "M3 ability actor capacity");
    assertValidCapacity(options.dirtyCapacity, "M3 ability dirty capacity");
    this.actorCapacity = options.actorCapacity;
    this.dirtyCapacity = options.dirtyCapacity;
    const laneCapacity = options.actorCapacity * M3_ABILITY_LANE_COUNT;
    this.baseValues = new Uint16Array(laneCapacity);
    this.cachedValues = new Uint16Array(laneCapacity);
    this.baseVersions = new Uint32Array(laneCapacity);
    this.sourceConditionVersions = new Uint32Array(laneCapacity);
    this.valid = new Uint8Array(laneCapacity);
    this.dirty = new Uint8Array(laneCapacity);
    this.dirtyActors = new Uint32Array(options.dirtyCapacity);
    this.dirtyAbilities = new Uint8Array(options.dirtyCapacity);
    this.dirtyReasons = new Uint8Array(options.dirtyCapacity);
    this.baseValues.fill(1000);
    this.penaltyIntoOutput = { penalty: 0, visited: 0 };
    this.legacyQueryIntoOutput = {
      ok: false,
      reason: "ability.actor_out_of_range",
      actorId: 0,
      ability: 0,
      value: 0,
      threshold: 0,
      baseValue: 0,
      conditionPenalty: 0,
      actorConditionVersion: 0,
      baseAbilityVersion: 0,
      visitedConditionCount: 0,
    };
  }

  setBaseAbility(
    actorId: number,
    ability: number,
    value: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3AbilityReason } {
    const validation = this.validateActorAbility(actorId, ability);
    if (!validation.ok) {
      return validation;
    }
    if (!isSeverity(value)) {
      return { ok: false, reason: "ability.value_out_of_range" };
    }
    const lane = laneIndex(actorId, ability);
    this.baseValues[lane] = value;
    this.baseVersions[lane] = (this.baseVersions[lane] ?? 0) + 1;
    return this.invalidateLane(actorId, ability, "ability.cache_invalidated");
  }

  queryAbility(
    actorId: number,
    ability: number,
    conditionStore: M3HealthConditionStore,
    minimumValue: number,
  ): M3AbilityQueryResult {
    const output = this.legacyQueryIntoOutput;
    this.queryAbilityInto(actorId, ability, conditionStore, minimumValue, output);
    if (output.ok) {
      return {
        ok: true,
        reason:
          output.reason === "ability.cache_rebuilt" ? "ability.cache_rebuilt" : "ability.cache_hit",
        actorId: output.actorId,
        ability: output.ability,
        value: output.value,
        baseValue: output.baseValue,
        conditionPenalty: output.conditionPenalty,
        actorConditionVersion: output.actorConditionVersion,
        baseAbilityVersion: output.baseAbilityVersion,
        visitedConditionCount: output.visitedConditionCount,
      };
    }
    return {
      ok: false,
      reason: output.reason,
      actorId: output.actorId,
      ability: output.ability,
      value: output.value,
      threshold: output.threshold,
      actorConditionVersion: output.actorConditionVersion,
      baseAbilityVersion: output.baseAbilityVersion,
      visitedConditionCount: output.visitedConditionCount,
    };
  }

  queryAbilityInto(
    actorId: number,
    ability: number,
    conditionStore: M3HealthConditionStore,
    minimumValue: number,
    output: M3AbilityQueryIntoOutput,
  ): void {
    this.resetAbilityIntoOutput(actorId, ability, minimumValue, output);
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      output.reason = "ability.actor_out_of_range";
      return;
    }
    if (!isAbilityLane(ability)) {
      output.reason = "ability.lane_out_of_range";
      return;
    }
    if (!isSeverity(minimumValue)) {
      output.reason = "ability.value_out_of_range";
      this.failureCount += 1;
      return;
    }

    this.queryCount += 1;
    const lane = laneIndex(actorId, ability);
    let visited = 0;
    let reason: M3AbilityReason = "ability.cache_hit";
    const conditionVersion = conditionStore.actorConditionVersion(actorId);
    if (
      this.valid[lane] !== 1 ||
      this.dirty[lane] === 1 ||
      this.sourceConditionVersions[lane] !== conditionVersion
    ) {
      if (this.valid[lane] === 1) this.staleRejectCount += 1;
      conditionStore.computeAbilityPenaltyInto(actorId, ability, this.penaltyIntoOutput);
      visited = this.penaltyIntoOutput.visited;
      this.visitedRows += visited;
      const baseValue = this.baseValues[lane] ?? 1000;
      this.cachedValues[lane] = clampAbilityValue(baseValue - this.penaltyIntoOutput.penalty);
      this.sourceConditionVersions[lane] = conditionVersion;
      this.valid[lane] = 1;
      this.dirty[lane] = 0;
      this.rebuildCount += 1;
      reason = "ability.cache_rebuilt";
    } else {
      this.hitCount += 1;
    }

    const value = this.cachedValues[lane] ?? 0;
    const baseValue = this.baseValues[lane] ?? 1000;
    output.reason = reason;
    output.value = value;
    output.baseValue = baseValue;
    output.conditionPenalty = baseValue - value;
    output.actorConditionVersion = conditionVersion;
    output.baseAbilityVersion = this.baseVersions[lane] ?? 0;
    output.visitedConditionCount = visited;
    if (value < minimumValue) {
      output.reason = "ability.rejected_below_threshold";
      this.failureCount += 1;
      return;
    }
    output.ok = true;
  }

  invalidateConditionAbilityLane(
    actorId: number,
    ability: number,
    _actorConditionVersion: number,
    reason: M3AbilityReason,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3AbilityReason } {
    return this.invalidateLane(actorId, ability, reason);
  }

  drainInvalidationBacklog(maxCount: number): number {
    if (!isPositiveSafeInteger(maxCount)) {
      return 0;
    }
    let drained = 0;
    while (this.dirtyCount > 0 && drained < maxCount) {
      this.dirtyReadCursor = (this.dirtyReadCursor + 1) % this.dirtyCapacity;
      this.dirtyCount -= 1;
      drained += 1;
    }
    return drained;
  }

  createMetrics(): M3AbilityMetrics {
    return {
      abilityQueryCount: this.queryCount,
      abilityCacheHitCount: this.hitCount,
      abilityCacheRebuildCount: this.rebuildCount,
      staleBasisRejectCount: this.staleRejectCount,
      abilityInvalidationCount: this.invalidationCount,
      abilityFailureCount: this.failureCount,
      conditionRowsVisitedOnRebuild: this.visitedRows,
      abilityDirtyBacklog: this.dirtyCount,
      abilityDirtyPeak: this.dirtyPeak,
    };
  }

  createHash(conditions: M3HealthConditionStore): number {
    let hash = mixUint32(conditions.createHash(), M3_ABILITY_LANE_COUNT);
    for (let actorId = 0; actorId < this.actorCapacity; actorId += 1) {
      for (let ability = 0; ability < M3_ABILITY_LANE_COUNT; ability += 1) {
        const lane = laneIndex(actorId, ability);
        hash = mixUint32(hash, actorId);
        hash = mixUint32(hash, ability);
        hash = mixUint32(hash, this.baseValues[lane] ?? 1000);
        hash = mixUint32(hash, this.cachedValues[lane] ?? 0);
        hash = mixUint32(hash, this.valid[lane] ?? 0);
        hash = mixUint32(hash, this.sourceConditionVersions[lane] ?? 0);
      }
    }
    return hash;
  }

  private invalidateLane(
    actorId: number,
    ability: number,
    reason: M3AbilityReason,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3AbilityReason } {
    const validation = this.validateActorAbility(actorId, ability);
    if (!validation.ok) {
      return validation;
    }
    const lane = laneIndex(actorId, ability);
    this.valid[lane] = 0;
    this.dirty[lane] = 1;
    if (this.dirtyCount >= this.dirtyCapacity) {
      return { ok: false, reason: "ability.dirty_queue_overflow" };
    }
    const slot = this.dirtyWriteCursor;
    this.dirtyActors[slot] = actorId;
    this.dirtyAbilities[slot] = ability;
    this.dirtyReasons[slot] = encodeAbilityReason(reason);
    this.dirtyWriteCursor = (this.dirtyWriteCursor + 1) % this.dirtyCapacity;
    this.dirtyCount += 1;
    this.dirtyPeak = Math.max(this.dirtyPeak, this.dirtyCount);
    this.invalidationCount += 1;
    return { ok: true };
  }

  private validateActorAbility(
    actorId: number,
    ability: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3AbilityReason } {
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      return { ok: false, reason: "ability.actor_out_of_range" };
    }
    if (!isAbilityLane(ability)) {
      return { ok: false, reason: "ability.lane_out_of_range" };
    }
    return { ok: true };
  }

  private resetAbilityIntoOutput(
    actorId: number,
    ability: number,
    threshold: number,
    output: M3AbilityQueryIntoOutput,
  ): void {
    output.ok = false;
    output.reason = "ability.actor_out_of_range";
    output.actorId = actorId;
    output.ability = ability;
    output.value = 0;
    output.threshold = threshold;
    output.baseValue = 0;
    output.conditionPenalty = 0;
    output.actorConditionVersion = 0;
    output.baseAbilityVersion = 0;
    output.visitedConditionCount = 0;
  }
}

export function createM3HealthConditionStore(
  options: M3HealthConditionStoreOptions,
): M3HealthConditionStore {
  return new M3HealthConditionStore(options);
}

export function createM3AbilityCacheStore(
  options: M3AbilityCacheStoreOptions,
): M3AbilityCacheStore {
  return new M3AbilityCacheStore(options);
}

function validateTreatmentPrepare(
  input: M3HealthTreatmentConditionDeltaPrepareInput,
  actorId: number,
  defId: number,
  severity: number,
  terminalState: number,
  abilityMask: number,
  storeVersion: number,
  conditionVersion: number,
  actorConditionVersion: number,
  updateCount: number,
  invalidationCount: number,
  invalidationWriteCount: number,
  dirtyCount: number,
  dirtyCapacity: number,
): M3HealthTreatmentPrepareReason | undefined {
  const basisReason = validateTreatmentPrepareBasis(
    input,
    actorId,
    defId,
    severity,
    terminalState,
    abilityMask,
    storeVersion,
    conditionVersion,
    actorConditionVersion,
  );
  if (basisReason !== undefined) return basisReason;
  return validateTreatmentPrepareHeadroom(
    storeVersion,
    conditionVersion,
    actorConditionVersion,
    updateCount,
    invalidationCount,
    invalidationWriteCount,
    dirtyCount,
    dirtyCapacity,
  );
}

function validateTreatmentPrepareBasis(
  input: M3HealthTreatmentConditionDeltaPrepareInput,
  actorId: number,
  defId: number,
  severity: number,
  terminalState: number,
  abilityMask: number,
  storeVersion: number,
  conditionVersion: number,
  actorConditionVersion: number,
): M3HealthTreatmentPrepareReason | undefined {
  if (input.expectedActorId !== actorId || input.expectedDefId !== defId)
    return "condition.identity_stale";
  if (
    input.expectedSeverity !== severity ||
    input.expectedTerminalState !== terminalState ||
    input.expectedAffectedAbilityMask !== abilityMask
  )
    return "condition.value_stale";
  if (
    terminalState !== M3_HEALTH_CONDITION_ACTIVE &&
    terminalState !== M3_HEALTH_CONDITION_RECOVERING
  )
    return "condition.terminal_state_out_of_range";
  if (
    !Number.isSafeInteger(input.severityDelta) ||
    input.severityDelta <= 0 ||
    input.severityDelta > 1000
  )
    return "condition.severity_out_of_range";
  if (
    input.expectedStoreVersion !== storeVersion ||
    input.expectedConditionVersion !== conditionVersion ||
    input.expectedActorConditionVersion !== actorConditionVersion
  )
    return "condition.version_stale";
  return undefined;
}

function validateTreatmentPrepareHeadroom(
  storeVersion: number,
  conditionVersion: number,
  actorConditionVersion: number,
  updateCount: number,
  invalidationCount: number,
  invalidationWriteCount: number,
  dirtyCount: number,
  dirtyCapacity: number,
): M3HealthTreatmentPrepareReason | undefined {
  if (
    storeVersion > UINT32_PREPARE_MAX ||
    conditionVersion > UINT32_PREPARE_MAX ||
    actorConditionVersion > UINT32_PREPARE_MAX
  )
    return "condition.version_exhausted";
  if (updateCount > UINT32_PREPARE_MAX || invalidationCount > UINT32_MAX - invalidationWriteCount)
    return "condition.counter_exhausted";
  if (dirtyCount + invalidationWriteCount > dirtyCapacity) return "condition.dirty_queue_overflow";
  return undefined;
}

function writePreparedM3HealthTreatment(
  output: PreparedM3HealthTreatmentConditionDelta,
  conditionId: number,
  actorId: number,
  abilityMask: number,
  previousSeverity: number,
  severityDelta: number,
  previousTerminalState: number,
  storeVersion: number,
  conditionVersion: number,
  actorConditionVersion: number,
  updateCount: number,
  invalidationCount: number,
  dirtyWriteCursor: number,
  dirtyCount: number,
  dirtyPeak: number,
  dirtyCapacity: number,
  invalidationWriteCount: number,
): void {
  const nextSeverity = previousSeverity > severityDelta ? previousSeverity - severityDelta : 0;
  const nextDirtyCount = dirtyCount + invalidationWriteCount;
  output.ok = true;
  output.reason = "condition.treatment_prepared";
  output.conditionId = conditionId;
  output.actorId = actorId;
  output.abilityMask = abilityMask;
  output.previousSeverity = previousSeverity;
  output.nextSeverity = nextSeverity;
  output.previousTerminalState = previousTerminalState;
  output.nextTerminalState =
    nextSeverity === 0 ? M3_HEALTH_CONDITION_RESOLVED : M3_HEALTH_CONDITION_RECOVERING;
  output.previousStoreVersion = storeVersion;
  output.nextStoreVersion = storeVersion + 1;
  output.previousConditionVersion = conditionVersion;
  output.nextConditionVersion = conditionVersion + 1;
  output.previousActorConditionVersion = actorConditionVersion;
  output.nextActorConditionVersion = actorConditionVersion + 1;
  output.previousUpdateCount = updateCount;
  output.nextUpdateCount = updateCount + 1;
  output.previousInvalidationCount = invalidationCount;
  output.nextInvalidationCount = invalidationCount + invalidationWriteCount;
  output.previousDirtyWriteCursor = dirtyWriteCursor;
  output.nextDirtyWriteCursor = (dirtyWriteCursor + invalidationWriteCount) % dirtyCapacity;
  output.previousDirtyCount = dirtyCount;
  output.nextDirtyCount = nextDirtyCount;
  output.previousDirtyPeak = dirtyPeak;
  output.nextDirtyPeak = dirtyPeak > nextDirtyCount ? dirtyPeak : nextDirtyCount;
  output.invalidationWriteCount = invalidationWriteCount;
}

function setTreatmentPrepareFailure(
  output: PreparedM3HealthTreatmentConditionDelta,
  reason: M3HealthTreatmentPrepareReason,
): void {
  output.reason = reason;
}

function resetM3HealthConditionIntoOutput(
  conditionId: number,
  output: M3HealthConditionIntoOutput,
): void {
  output.ok = false;
  output.conditionId = conditionId;
  output.actorId = 0;
  output.defId = 0;
  output.kind = 0;
  output.bodyPart = 0;
  output.severity = 0;
  output.ageTicks = 0;
  output.sourceId = 0;
  output.componentFlags = 0;
  output.clueRef = 0;
  output.counterevidenceRef = 0;
  output.terminalState = 0;
  output.affectedAbilityMask = 0;
  output.storeVersion = 0;
  output.conditionVersion = 0;
  output.actorConditionVersion = 0;
  output.updateCount = 0;
  output.invalidationCount = 0;
  output.dirtyWriteCursor = 0;
  output.dirtyCount = 0;
  output.dirtyPeak = 0;
  output.dirtyCapacity = 0;
}

function resetPreparedM3HealthTreatment(output: PreparedM3HealthTreatmentConditionDelta): void {
  output.ok = false;
  output.reason = "condition.not_active";
  output.conditionId = M3_HEALTH_CONDITION_NONE;
  output.actorId = 0;
  output.abilityMask = 0;
  output.previousSeverity = 0;
  output.nextSeverity = 0;
  output.previousTerminalState = 0;
  output.nextTerminalState = 0;
  output.previousStoreVersion = 0;
  output.nextStoreVersion = 0;
  output.previousConditionVersion = 0;
  output.nextConditionVersion = 0;
  output.previousActorConditionVersion = 0;
  output.nextActorConditionVersion = 0;
  output.previousUpdateCount = 0;
  output.nextUpdateCount = 0;
  output.previousInvalidationCount = 0;
  output.nextInvalidationCount = 0;
  output.previousDirtyWriteCursor = 0;
  output.nextDirtyWriteCursor = 0;
  output.previousDirtyCount = 0;
  output.nextDirtyCount = 0;
  output.previousDirtyPeak = 0;
  output.nextDirtyPeak = 0;
  output.invalidationWriteCount = 0;
}

export function createM3HealthAbilityMask(abilities: readonly number[]): number {
  let mask = 0;
  for (const ability of abilities) {
    if (isAbilityLane(ability)) {
      mask |= abilityMaskFor(ability);
    }
  }
  return mask;
}

function mixCondition(hash: number, conditionId: number, store: M3HealthConditionStore): number {
  const condition = store.readCondition(conditionId);
  if (condition === undefined) {
    return hash;
  }
  let next = mixUint32(hash, condition.conditionId);
  next = mixUint32(next, condition.actorId);
  next = mixUint32(next, condition.defId);
  next = mixUint32(next, condition.kind);
  next = mixUint32(next, condition.bodyPart);
  next = mixUint32(next, condition.severity);
  next = mixUint32(next, condition.ageTicks);
  next = mixUint32(next, condition.sourceId);
  next = mixUint32(next, condition.componentFlags);
  next = mixUint32(next, condition.clueRef);
  next = mixUint32(next, condition.counterevidenceRef);
  next = mixUint32(next, condition.terminalState);
  next = mixUint32(next, condition.affectedAbilityMask);
  next = mixUint32(next, condition.actorConditionVersion);
  next = mixUint32(next, condition.conditionVersion);
  return next;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function abilityMaskFor(ability: number): number {
  return 1 << ability;
}

function abilityMaskAll(): number {
  return (1 << M3_ABILITY_LANE_COUNT) - 1;
}

function countAbilityMaskLanes(abilityMask: number): number {
  let count = 0;
  for (let ability = 0; ability < M3_ABILITY_LANE_COUNT; ability += 1) {
    if ((abilityMask & abilityMaskFor(ability)) !== 0) {
      count += 1;
    }
  }
  return count;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function laneIndex(actorId: number, ability: number): number {
  return actorId * M3_ABILITY_LANE_COUNT + ability;
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function isAbilityLane(value: number): boolean {
  return isIndexInRange(value, M3_ABILITY_LANE_COUNT);
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function isSeverity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}

function isTerminalState(value: number): boolean {
  return (
    value === M3_HEALTH_CONDITION_ACTIVE ||
    value === M3_HEALTH_CONDITION_RECOVERING ||
    value === M3_HEALTH_CONDITION_RESOLVED ||
    value === M3_HEALTH_CONDITION_REMOVED
  );
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function clampAbilityValue(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1000) {
    return 1000;
  }
  return value;
}

function encodeAbilityReason(reason: M3AbilityReason): number {
  if (reason === "ability.cache_invalidated") {
    return 1;
  }
  if (reason === "ability.cache_hit") {
    return 4;
  }
  if (reason === "ability.cache_stale_basis") {
    return 2;
  }
  if (reason === "ability.rejected_below_threshold") {
    return 3;
  }
  return 0;
}

function decodeAbilityReason(code: number): M3AbilityReason {
  if (code === 1) {
    return "ability.cache_invalidated";
  }
  if (code === 4) {
    return "ability.cache_hit";
  }
  if (code === 2) {
    return "ability.cache_stale_basis";
  }
  if (code === 3) {
    return "ability.rejected_below_threshold";
  }
  return "ability.cache_rebuilt";
}
