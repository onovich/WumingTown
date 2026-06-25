import {
  M4_TOWN_RULE_DEFAULT_ACTION_CAPACITY,
  M4_TOWN_RULE_DEFAULT_TRIGGER_CAPACITY,
  M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY,
  M4_TOWN_RULE_EXCEPTION_EMERGENCY,
  M4_TOWN_RULE_NONE,
  M4_TOWN_RULE_STATE_ACTIVE,
  M4_TOWN_RULE_STATE_RETIRED,
  M4_TOWN_RULE_STATE_SUSPENDED,
  type M4TownRuleComplianceContext,
  type M4TownRuleComplianceResult,
  type M4TownRuleInput,
  type M4TownRuleMetrics,
  type M4TownRuleMutationResult,
  type M4TownRuleReason,
  type M4TownRuleStoreOptions,
  type M4TownRuleView,
} from "./m4-town-rule-types";
import {
  m4IsIndexInRange,
  m4IsPositiveSafeInteger,
  m4IsUint32,
  m4RequirePositiveSafeInteger,
} from "./m4-obligation-types";

export class M4TownRuleStore {
  readonly ruleCapacity: number;
  readonly subjectCapacity: number;
  readonly regionCapacity: number;
  readonly triggerCapacity: number;
  readonly actionCapacity: number;

  private readonly active: Uint8Array;
  private readonly scopes: Uint16Array;
  private readonly timeStarts: Uint32Array;
  private readonly timeEnds: Uint32Array;
  private readonly regionIds: Uint32Array;
  private readonly triggers: Uint16Array;
  private readonly actions: Uint16Array;
  private readonly exceptions: Uint16Array;
  private readonly enforcementMethods: Uint16Array;
  private readonly enforcementCosts: Uint32Array;
  private readonly legitimacySources: Uint16Array;
  private readonly penalties: Uint16Array;
  private readonly states: Uint8Array;
  private readonly versions: Uint32Array;
  private readonly bucketHeads: Int32Array;
  private readonly nextByRule: Int32Array;
  private readonly previousByRule: Int32Array;
  private readonly linked: Uint8Array;
  private activeCountValue = 0;
  private indexedCountValue = 0;
  private lastComplianceVisits = 0;
  private totalComplianceVisits = 0;
  private enforcementCostTotal = 0;
  private ownerVersionValue = 0;

  constructor(options: M4TownRuleStoreOptions) {
    this.ruleCapacity = m4RequirePositiveSafeInteger(options.ruleCapacity, "town rule capacity");
    this.subjectCapacity = m4RequirePositiveSafeInteger(
      options.subjectCapacity,
      "town rule subject capacity",
    );
    this.regionCapacity = m4RequirePositiveSafeInteger(
      options.regionCapacity,
      "town rule region capacity",
    );
    this.triggerCapacity = m4RequirePositiveSafeInteger(
      options.triggerCapacity ?? M4_TOWN_RULE_DEFAULT_TRIGGER_CAPACITY,
      "town rule trigger capacity",
    );
    this.actionCapacity = m4RequirePositiveSafeInteger(
      options.actionCapacity ?? M4_TOWN_RULE_DEFAULT_ACTION_CAPACITY,
      "town rule action capacity",
    );
    this.active = new Uint8Array(this.ruleCapacity);
    this.scopes = new Uint16Array(this.ruleCapacity);
    this.timeStarts = new Uint32Array(this.ruleCapacity);
    this.timeEnds = new Uint32Array(this.ruleCapacity);
    this.regionIds = filledUint32(this.ruleCapacity);
    this.triggers = new Uint16Array(this.ruleCapacity);
    this.actions = new Uint16Array(this.ruleCapacity);
    this.exceptions = new Uint16Array(this.ruleCapacity);
    this.enforcementMethods = new Uint16Array(this.ruleCapacity);
    this.enforcementCosts = new Uint32Array(this.ruleCapacity);
    this.legitimacySources = new Uint16Array(this.ruleCapacity);
    this.penalties = new Uint16Array(this.ruleCapacity);
    this.states = new Uint8Array(this.ruleCapacity);
    this.versions = new Uint32Array(this.ruleCapacity);
    this.bucketHeads = filledInt32(
      this.subjectCapacity * this.regionCapacity * this.triggerCapacity * this.actionCapacity,
    );
    this.nextByRule = filledInt32(this.ruleCapacity);
    this.previousByRule = filledInt32(this.ruleCapacity);
    this.linked = new Uint8Array(this.ruleCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerRule(input: M4TownRuleInput): M4TownRuleMutationResult {
    const valid = this.validateInput(input);
    if (!valid.ok) return valid;
    if ((this.active[input.ruleId] ?? 0) === 1) {
      return { ok: false, reason: "town_rule_already_registered" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.active[input.ruleId] = 1;
    this.scopes[input.ruleId] = input.subjectScope;
    this.timeStarts[input.ruleId] = input.timeStartTick;
    this.timeEnds[input.ruleId] = input.timeEndTick;
    this.regionIds[input.ruleId] = input.regionId;
    this.triggers[input.ruleId] = input.trigger;
    this.actions[input.ruleId] = input.action;
    this.exceptions[input.ruleId] = input.exception;
    this.enforcementMethods[input.ruleId] = input.enforcementMethod;
    this.enforcementCosts[input.ruleId] = input.enforcementCost;
    this.legitimacySources[input.ruleId] = input.legitimacySource;
    this.penalties[input.ruleId] = input.penalty;
    this.states[input.ruleId] = M4_TOWN_RULE_STATE_ACTIVE;
    this.versions[input.ruleId] = nextVersion.ownerVersion;
    this.activeCountValue += 1;
    this.linkRule(input.ruleId);
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(input.ruleId, "town_rule_candidates_indexed");
  }

  retireRule(ruleId: number): M4TownRuleMutationResult {
    const valid = this.validateActiveRule(ruleId);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.unlinkRule(ruleId);
    this.states[ruleId] = M4_TOWN_RULE_STATE_RETIRED;
    this.versions[ruleId] = nextVersion.ownerVersion;
    this.activeCountValue -= 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(ruleId, "town_rule_candidates_indexed");
  }

  evaluateCompliance(
    context: M4TownRuleComplianceContext,
    outputRuleIds: Uint32Array,
  ): M4TownRuleComplianceResult {
    const valid = this.validateContext(context, outputRuleIds);
    if (!valid.ok) return valid;
    clearOutput(outputRuleIds, context.candidateCap);
    const bucket = this.createBucketKey(
      context.subjectId,
      context.regionId,
      context.trigger,
      context.action,
    );
    let current = this.bucketHeads[bucket] ?? -1;
    let visited = 0;
    let selected = 0;
    let selectedRule = M4_TOWN_RULE_NONE;
    let selectedReason: M4TownRuleReason = "town_rule_no_candidate";
    let cost = 0;
    let candidateCapHit = false;
    let scanCapHit = false;
    while (current >= 0) {
      if (visited >= context.scanCap) {
        scanCapHit = true;
        break;
      }
      visited += 1;
      if (this.isRuleInTime(current, context.tick)) {
        if (selected >= context.candidateCap) {
          candidateCapHit = true;
          break;
        }
        outputRuleIds[selected] = current;
        selected += 1;
        if (selected === context.candidateCap) {
          candidateCapHit = (this.nextByRule[current] ?? -1) >= 0;
          const reason = this.evaluateRule(current, context);
          if (
            selectedRule === M4_TOWN_RULE_NONE ||
            reason === "town_rule_compliance_allowed" ||
            reason === "town_rule_enforcement_cost_applied"
          ) {
            selectedRule = current;
            selectedReason = reason;
            cost =
              reason === "town_rule_compliance_allowed" ||
              reason === "town_rule_enforcement_cost_applied"
                ? (this.enforcementCosts[current] ?? 0)
                : 0;
          }
          break;
        }
        const reason = this.evaluateRule(current, context);
        if (
          selectedRule === M4_TOWN_RULE_NONE ||
          reason === "town_rule_compliance_allowed" ||
          reason === "town_rule_enforcement_cost_applied"
        ) {
          selectedRule = current;
          selectedReason = reason;
          cost =
            reason === "town_rule_compliance_allowed" ||
            reason === "town_rule_enforcement_cost_applied"
              ? (this.enforcementCosts[current] ?? 0)
              : 0;
        }
      }
      current = this.nextByRule[current] ?? -1;
    }
    this.lastComplianceVisits = visited;
    this.totalComplianceVisits += visited;
    if (
      selectedReason === "town_rule_compliance_allowed" ||
      selectedReason === "town_rule_enforcement_cost_applied"
    ) {
      this.enforcementCostTotal += cost;
    }
    const reason = scanCapHit
      ? "town_rule_scan_cap_reached"
      : candidateCapHit &&
          selectedReason !== "town_rule_compliance_allowed" &&
          selectedReason !== "town_rule_enforcement_cost_applied"
        ? "town_rule_candidate_cap_reached"
        : selectedReason;
    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      candidateCapHit,
      scanCapHit,
      selectedRuleId: selectedRule,
      enforcementCost: cost,
      ownerVersion: this.ownerVersionValue,
      reason,
    };
  }

  readRule(ruleId: number): M4TownRuleView | undefined {
    if (!this.isRegistered(ruleId)) return undefined;
    return {
      ruleId,
      subjectScope: this.scopes[ruleId] ?? 0,
      timeStartTick: this.timeStarts[ruleId] ?? 0,
      timeEndTick: this.timeEnds[ruleId] ?? 0,
      regionId: this.regionIds[ruleId] ?? M4_TOWN_RULE_NONE,
      trigger: this.triggers[ruleId] ?? 0,
      action: this.actions[ruleId] ?? 0,
      exception: this.exceptions[ruleId] ?? 0,
      enforcementMethod: this.enforcementMethods[ruleId] ?? 0,
      enforcementCost: this.enforcementCosts[ruleId] ?? 0,
      legitimacySource: this.legitimacySources[ruleId] ?? 0,
      penalty: this.penalties[ruleId] ?? 0,
      state: this.states[ruleId] ?? 0,
      ruleVersion: this.versions[ruleId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  createMetrics(): M4TownRuleMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeCount: this.activeCountValue,
      complianceIndexedCount: this.indexedCountValue,
      lastComplianceCandidateVisits: this.lastComplianceVisits,
      totalComplianceCandidateVisits: this.totalComplianceVisits,
      enforcementCostTotal: this.enforcementCostTotal,
    };
  }

  private evaluateRule(ruleId: number, context: M4TownRuleComplianceContext): M4TownRuleReason {
    if (context.knowsRule === 0) return "town_rule_rejected_unknown";
    const exception = this.exceptions[ruleId] ?? 0;
    if (context.emergency > 0 && hasException(exception, M4_TOWN_RULE_EXCEPTION_EMERGENCY)) {
      return "town_rule_rejected_emergency_exception";
    }
    if (
      context.confirmedIdentity > 0 &&
      hasException(exception, M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY)
    ) {
      return "town_rule_rejected_confirmed_identity_exception";
    }
    if (context.obligationPressure >= 800) return "town_rule_rejected_obligation_pressure";
    if (context.needPressure >= 800) return "town_rule_rejected_need";
    if (context.relationshipPressure >= 800) return "town_rule_rejected_relationship";
    if (context.fear >= 800 && context.enforcementRisk < 500) return "town_rule_rejected_fear";
    return this.enforcementCosts[ruleId] === 0
      ? "town_rule_compliance_allowed"
      : "town_rule_enforcement_cost_applied";
  }

  private validateInput(
    input: M4TownRuleInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4TownRuleReason } {
    if (
      !m4IsIndexInRange(input.ruleId, this.ruleCapacity) ||
      !m4IsIndexInRange(input.subjectScope, this.subjectCapacity) ||
      !m4IsIndexInRange(input.regionId, this.regionCapacity) ||
      !m4IsIndexInRange(input.trigger, this.triggerCapacity) ||
      !m4IsIndexInRange(input.action, this.actionCapacity)
    ) {
      return { ok: false, reason: "town_rule_id_out_of_range" };
    }
    if (
      !m4IsUint32(input.timeStartTick) ||
      !m4IsUint32(input.timeEndTick) ||
      input.timeStartTick > input.timeEndTick
    ) {
      return { ok: false, reason: "town_rule_time_window_invalid" };
    }
    return isSmallPositive(input.trigger) &&
      isSmallPositive(input.action) &&
      isSmallNonNegative(input.exception) &&
      isSmallPositive(input.enforcementMethod) &&
      m4IsUint32(input.enforcementCost) &&
      isSmallPositive(input.legitimacySource) &&
      isSmallPositive(input.penalty)
      ? { ok: true }
      : { ok: false, reason: "town_rule_value_out_of_range" };
  }

  private validateContext(
    context: M4TownRuleComplianceContext,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4TownRuleReason } {
    if (
      !m4IsIndexInRange(context.subjectId, this.subjectCapacity) ||
      !m4IsIndexInRange(context.regionId, this.regionCapacity) ||
      !m4IsIndexInRange(context.trigger, this.triggerCapacity) ||
      !m4IsIndexInRange(context.action, this.actionCapacity)
    )
      return { ok: false, reason: "town_rule_id_out_of_range" };
    if (!m4IsPositiveSafeInteger(context.candidateCap))
      return { ok: false, reason: "town_rule_candidate_cap_invalid" };
    if (!m4IsPositiveSafeInteger(context.scanCap))
      return { ok: false, reason: "town_rule_candidate_cap_invalid" };
    if (output.length < context.candidateCap)
      return { ok: false, reason: "town_rule_output_too_small" };
    return m4IsUint32(context.tick) &&
      isContextLane(context.knowsRule) &&
      isContextLane(context.needPressure) &&
      isContextLane(context.relationshipPressure) &&
      isContextLane(context.fear) &&
      isContextLane(context.enforcementRisk) &&
      isContextLane(context.emergency) &&
      isContextLane(context.confirmedIdentity) &&
      isContextLane(context.obligationPressure)
      ? { ok: true }
      : { ok: false, reason: "town_rule_value_out_of_range" };
  }

  private validateActiveRule(
    ruleId: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4TownRuleReason } {
    if (!this.isRegistered(ruleId)) return { ok: false, reason: "town_rule_not_registered" };
    const state = this.states[ruleId] ?? 0;
    return state === M4_TOWN_RULE_STATE_ACTIVE || state === M4_TOWN_RULE_STATE_SUSPENDED
      ? { ok: true }
      : { ok: false, reason: "town_rule_terminal_state" };
  }

  private linkRule(ruleId: number): void {
    const key = this.createBucketKey(
      this.scopes[ruleId] ?? 0,
      this.regionIds[ruleId] ?? 0,
      this.triggers[ruleId] ?? 0,
      this.actions[ruleId] ?? 0,
    );
    let current = this.bucketHeads[key] ?? -1;
    let previous = -1;
    while (current >= 0 && current < ruleId) {
      previous = current;
      current = this.nextByRule[current] ?? -1;
    }
    this.previousByRule[ruleId] = previous;
    this.nextByRule[ruleId] = current;
    if (previous >= 0) this.nextByRule[previous] = ruleId;
    else this.bucketHeads[key] = ruleId;
    if (current >= 0) this.previousByRule[current] = ruleId;
    this.linked[ruleId] = 1;
    this.indexedCountValue += 1;
  }

  private unlinkRule(ruleId: number): void {
    if ((this.linked[ruleId] ?? 0) === 0) return;
    const key = this.createBucketKey(
      this.scopes[ruleId] ?? 0,
      this.regionIds[ruleId] ?? 0,
      this.triggers[ruleId] ?? 0,
      this.actions[ruleId] ?? 0,
    );
    const previous = this.previousByRule[ruleId] ?? -1;
    const next = this.nextByRule[ruleId] ?? -1;
    if (previous >= 0) this.nextByRule[previous] = next;
    else this.bucketHeads[key] = next;
    if (next >= 0) this.previousByRule[next] = previous;
    this.previousByRule[ruleId] = -1;
    this.nextByRule[ruleId] = -1;
    this.linked[ruleId] = 0;
    this.indexedCountValue -= 1;
  }

  private isRegistered(ruleId: number): boolean {
    return m4IsIndexInRange(ruleId, this.ruleCapacity) && (this.active[ruleId] ?? 0) === 1;
  }

  private isRuleInTime(ruleId: number, tick: number): boolean {
    return (this.timeStarts[ruleId] ?? 0) <= tick && (this.timeEnds[ruleId] ?? 0) >= tick;
  }

  private createBucketKey(
    subjectId: number,
    regionId: number,
    trigger: number,
    action: number,
  ): number {
    return (
      ((subjectId * this.regionCapacity + regionId) * this.triggerCapacity + trigger) *
        this.actionCapacity +
      action
    );
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "town_rule_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "town_rule_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private changed(ruleId: number, reason: M4TownRuleReason): M4TownRuleMutationResult {
    return { ok: true, changed: true, ruleId, ownerVersion: this.ownerVersionValue, reason };
  }
}

export function createM4TownRuleStore(options: M4TownRuleStoreOptions): M4TownRuleStore {
  return new M4TownRuleStore(options);
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M4_TOWN_RULE_NONE;
}

function isContextLane(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isSmallPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff;
}

function isSmallNonNegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
}

function hasException(exceptionMask: number, exception: number): boolean {
  return (exceptionMask & exception) === exception;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M4_TOWN_RULE_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}
