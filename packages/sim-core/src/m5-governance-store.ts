import {
  M5_FACTION_GOVERNANCE_NONE,
  M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY,
  M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
  M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
  M5_GOVERNANCE_HOOK_MASK_ALL,
  M5_GOVERNANCE_HOOK_MASK_COUNCIL_POST_AUTHORITY,
  M5_GOVERNANCE_HOOK_MASK_ENFORCEMENT_CAPACITY,
  M5_GOVERNANCE_HOOK_MASK_LEGITIMACY_SOURCE,
  M5_GOVERNANCE_HOOK_MASK_RISK_FLAG,
  M5_GOVERNANCE_HOOK_MASK_TEMPORARY_POLICY_AUTHORITY,
  M5_GOVERNANCE_HOOK_RISK_FLAG,
  M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY,
  M5_GOVERNANCE_RISK_FLAG_ALL,
  type M5GovernanceHookInput,
  type M5GovernanceHookQuery,
  type M5GovernanceHookQueryResult,
  type M5GovernanceHookStoreOptions,
  type M5GovernanceHookView,
  type M5GovernanceMetrics,
  type M5GovernanceMutationResult,
  type M5GovernanceReason,
} from "./m5-faction-governance-types";

export class M5GovernanceHookStore {
  readonly hookCapacity: number;
  readonly policyCapacity: number;

  private readonly active: Uint8Array;
  private readonly policyIds: Uint32Array;
  private readonly hookKinds: Uint8Array;
  private readonly authorityActorIds: Uint32Array;
  private readonly councilPostIds: Uint32Array;
  private readonly temporaryPolicyIds: Uint32Array;
  private readonly enforcementCapacities: Uint16Array;
  private readonly legitimacySourceIds: Uint32Array;
  private readonly legitimacyScores: Uint16Array;
  private readonly riskFlags: Uint16Array;
  private readonly townRuleOwnerVersions: Uint32Array;
  private readonly obligationOwnerVersions: Uint32Array;
  private readonly chronicleOwnerVersions: Uint32Array;
  private readonly sourceEvents: Uint32Array;
  private readonly sourceOwnerVersions: Uint32Array;
  private readonly startsAtTicks: Uint32Array;
  private readonly expiresAtTicks: Uint32Array;
  private readonly priorities: Uint16Array;
  private readonly stableOwnerIds: Uint32Array;
  private readonly stableSequences: Uint32Array;
  private readonly hookVersions: Uint32Array;
  private readonly headsByPolicy: Int32Array;
  private readonly nextByHook: Int32Array;
  private readonly previousByHook: Int32Array;
  private readonly linked: Uint8Array;
  private readonly kindCounts: Uint32Array;
  private activeHookCountValue = 0;
  private indexedHookCountValue = 0;
  private ownerVersionValue = 0;
  private lastQueryVisitsValue = 0;
  private totalQueryVisitsValue = 0;
  private lastQuerySelectedValue = 0;
  private queryCapHitCountValue = 0;
  private staleBasisRejectCountValue = 0;
  private riskBlockedCountValue = 0;
  private insufficientLegitimacyCountValue = 0;

  constructor(options: M5GovernanceHookStoreOptions) {
    this.hookCapacity = requirePositive(options.hookCapacity, "hook capacity");
    this.policyCapacity = requirePositive(options.policyCapacity, "policy capacity");
    this.active = new Uint8Array(this.hookCapacity);
    this.policyIds = filledUint32(this.hookCapacity);
    this.hookKinds = new Uint8Array(this.hookCapacity);
    this.authorityActorIds = filledUint32(this.hookCapacity);
    this.councilPostIds = filledUint32(this.hookCapacity);
    this.temporaryPolicyIds = filledUint32(this.hookCapacity);
    this.enforcementCapacities = new Uint16Array(this.hookCapacity);
    this.legitimacySourceIds = filledUint32(this.hookCapacity);
    this.legitimacyScores = new Uint16Array(this.hookCapacity);
    this.riskFlags = new Uint16Array(this.hookCapacity);
    this.townRuleOwnerVersions = new Uint32Array(this.hookCapacity);
    this.obligationOwnerVersions = new Uint32Array(this.hookCapacity);
    this.chronicleOwnerVersions = new Uint32Array(this.hookCapacity);
    this.sourceEvents = filledUint32(this.hookCapacity);
    this.sourceOwnerVersions = new Uint32Array(this.hookCapacity);
    this.startsAtTicks = new Uint32Array(this.hookCapacity);
    this.expiresAtTicks = filledUint32(this.hookCapacity);
    this.priorities = new Uint16Array(this.hookCapacity);
    this.stableOwnerIds = filledUint32(this.hookCapacity);
    this.stableSequences = filledUint32(this.hookCapacity);
    this.hookVersions = new Uint32Array(this.hookCapacity);
    this.headsByPolicy = filledInt32(this.policyCapacity);
    this.nextByHook = filledInt32(this.hookCapacity);
    this.previousByHook = filledInt32(this.hookCapacity);
    this.linked = new Uint8Array(this.hookCapacity);
    this.kindCounts = new Uint32Array(M5_GOVERNANCE_HOOK_RISK_FLAG + 1);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  upsertHook(input: M5GovernanceHookInput): M5GovernanceMutationResult {
    const valid = this.validateInput(input);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    const wasActive = (this.active[input.hookId] ?? 0) === 1;
    if (wasActive) {
      this.unlinkHook(input.hookId);
      this.decrementKind(this.hookKinds[input.hookId] ?? 0);
    } else {
      this.activeHookCountValue += 1;
    }
    this.writeHook(input, nextVersion.ownerVersion);
    this.incrementKind(input.hookKind);
    this.linkHook(input.hookId);
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(input.hookId, "m5_governance_hook_indexed");
  }

  evaluatePolicyHooks(
    query: M5GovernanceHookQuery,
    outputHookIds: Uint32Array,
  ): M5GovernanceHookQueryResult {
    const valid = this.validateQuery(query, outputHookIds);
    if (!valid.ok) return valid;
    if (query.expectedOwnerVersion !== this.ownerVersionValue) {
      this.staleBasisRejectCountValue += 1;
      return { ok: false, reason: "m5_governance_query_stale_basis" };
    }
    clearOutput(outputHookIds, query.candidateCap);
    const selection = this.selectPolicyHooks(query, outputHookIds);
    this.lastQueryVisitsValue = selection.visited;
    this.totalQueryVisitsValue += selection.visited;
    this.lastQuerySelectedValue = selection.selected;
    if (selection.candidateCapHit || selection.scanCapHit) this.queryCapHitCountValue += 1;
    const reason = this.policyReason(query, selection);
    if (reason === "m5_governance_query_risk_blocked") this.riskBlockedCountValue += 1;
    if (reason === "m5_governance_query_insufficient_legitimacy")
      this.insufficientLegitimacyCountValue += 1;
    return {
      ok: true,
      selectedCount: selection.selected,
      visitedCount: selection.visited,
      candidateCapHit: selection.candidateCapHit,
      scanCapHit: selection.scanCapHit,
      allowed: reason === "m5_governance_query_allowed",
      policyPressureScore: clampScore(selection.enforcementCapacity + selection.legitimacyScore),
      enforcementCapacity: clampScore(selection.enforcementCapacity),
      legitimacyScore: clampScore(selection.legitimacyScore),
      riskFlags: selection.riskFlags,
      ownerVersion: this.ownerVersionValue,
      reason,
    };
  }

  readHook(hookId: number): M5GovernanceHookView | undefined {
    if (!isIndex(hookId, this.hookCapacity) || (this.active[hookId] ?? 0) === 0) return undefined;
    return {
      hookId,
      policyId: this.policyIds[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      hookKind: this.hookKinds[hookId] ?? 0,
      authorityActorId: this.authorityActorIds[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      councilPostId: this.councilPostIds[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      temporaryPolicyId: this.temporaryPolicyIds[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      enforcementCapacity: this.enforcementCapacities[hookId] ?? 0,
      legitimacySourceId: this.legitimacySourceIds[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      legitimacyScore: this.legitimacyScores[hookId] ?? 0,
      riskFlags: this.riskFlags[hookId] ?? 0,
      townRuleOwnerVersion: this.townRuleOwnerVersions[hookId] ?? 0,
      obligationOwnerVersion: this.obligationOwnerVersions[hookId] ?? 0,
      chronicleOwnerVersion: this.chronicleOwnerVersions[hookId] ?? 0,
      sourceEventId: this.sourceEvents[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      sourceOwnerVersion: this.sourceOwnerVersions[hookId] ?? 0,
      startsAtTick: this.startsAtTicks[hookId] ?? 0,
      expiresAtTick: this.expiresAtTicks[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      priority: this.priorities[hookId] ?? 0,
      stableOwnerId: this.stableOwnerIds[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      stableSequence: this.stableSequences[hookId] ?? M5_FACTION_GOVERNANCE_NONE,
      hookVersion: this.hookVersions[hookId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  createMetrics(): M5GovernanceMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeHookCount: this.activeHookCountValue,
      indexedHookCount: this.indexedHookCountValue,
      councilPostAuthorityCount: this.kindCounts[M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY] ?? 0,
      temporaryPolicyAuthorityCount:
        this.kindCounts[M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY] ?? 0,
      enforcementCapacityCount: this.kindCounts[M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY] ?? 0,
      legitimacySourceCount: this.kindCounts[M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE] ?? 0,
      riskFlagCount: this.kindCounts[M5_GOVERNANCE_HOOK_RISK_FLAG] ?? 0,
      lastQueryVisits: this.lastQueryVisitsValue,
      totalQueryVisits: this.totalQueryVisitsValue,
      lastQuerySelected: this.lastQuerySelectedValue,
      queryCapHitCount: this.queryCapHitCountValue,
      staleBasisRejectCount: this.staleBasisRejectCountValue,
      riskBlockedCount: this.riskBlockedCountValue,
      insufficientLegitimacyCount: this.insufficientLegitimacyCountValue,
    };
  }

  private selectPolicyHooks(
    query: M5GovernanceHookQuery,
    output: Uint32Array,
  ): {
    readonly selected: number;
    readonly visited: number;
    readonly candidateCapHit: boolean;
    readonly scanCapHit: boolean;
    readonly enforcementCapacity: number;
    readonly legitimacyScore: number;
    readonly riskFlags: number;
  } {
    let current = this.headsByPolicy[query.policyId] ?? -1;
    let visited = 0;
    let selected = 0;
    let candidateCapHit = false;
    let scanCapHit = false;
    let enforcementCapacity = 0;
    let legitimacyScore = 0;
    let riskFlags = 0;
    while (current >= 0) {
      if (visited >= query.scanCap) {
        scanCapHit = true;
        break;
      }
      visited += 1;
      if (this.hookMatches(current, query)) {
        if (selected >= query.candidateCap) {
          candidateCapHit = true;
          break;
        }
        output[selected] = current;
        selected += 1;
        enforcementCapacity += this.enforcementCapacities[current] ?? 0;
        legitimacyScore += this.legitimacyScores[current] ?? 0;
        riskFlags |= this.riskFlags[current] ?? 0;
      }
      current = this.nextByHook[current] ?? -1;
    }
    return {
      selected,
      visited,
      candidateCapHit,
      scanCapHit,
      enforcementCapacity,
      legitimacyScore,
      riskFlags,
    };
  }

  private policyReason(
    query: M5GovernanceHookQuery,
    selection: {
      readonly selected: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly legitimacyScore: number;
      readonly riskFlags: number;
    },
  ): M5GovernanceReason {
    if (selection.scanCapHit) return "m5_governance_query_scan_cap_reached";
    if (selection.candidateCapHit) return "m5_governance_query_cap_reached";
    if (selection.selected === 0) return "m5_governance_query_no_candidate";
    if ((selection.riskFlags & query.blockedRiskFlags) !== 0)
      return "m5_governance_query_risk_blocked";
    return selection.legitimacyScore >= query.minLegitimacyScore
      ? "m5_governance_query_allowed"
      : "m5_governance_query_insufficient_legitimacy";
  }

  private validateInput(
    input: M5GovernanceHookInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5GovernanceReason } {
    if (!isIndex(input.hookId, this.hookCapacity))
      return { ok: false, reason: "m5_governance_hook_id_out_of_range" };
    if (!isIndex(input.policyId, this.policyCapacity))
      return { ok: false, reason: "m5_governance_policy_id_invalid" };
    if (hookKindToMask(input.hookKind) === 0)
      return { ok: false, reason: "m5_governance_hook_kind_invalid" };
    if (!isEntityId(input.authorityActorId))
      return { ok: false, reason: "m5_governance_authority_actor_invalid" };
    if (!isOptionalEntityId(input.councilPostId) || !isOptionalEntityId(input.temporaryPolicyId))
      return { ok: false, reason: "m5_governance_reference_invalid" };
    if (!isScore(input.enforcementCapacity) || !isScore(input.legitimacyScore))
      return { ok: false, reason: "m5_governance_score_invalid" };
    if (!isEntityId(input.legitimacySourceId))
      return { ok: false, reason: "m5_governance_reference_invalid" };
    if (!isRiskFlags(input.riskFlags))
      return { ok: false, reason: "m5_governance_risk_flags_invalid" };
    return this.validateInputVersions(input);
  }

  private validateInputVersions(
    input: M5GovernanceHookInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5GovernanceReason } {
    if (
      !isPositiveUint32(input.townRuleOwnerVersion) ||
      !isPositiveUint32(input.obligationOwnerVersion) ||
      !isPositiveUint32(input.chronicleOwnerVersion) ||
      !isPositiveUint32(input.sourceOwnerVersion)
    ) {
      return { ok: false, reason: "m5_governance_source_version_invalid" };
    }
    if (!isEntityId(input.sourceEventId))
      return { ok: false, reason: "m5_governance_source_event_invalid" };
    if (
      !isUint32(input.startsAtTick) ||
      !isUint32(input.expiresAtTick) ||
      input.startsAtTick > input.expiresAtTick
    ) {
      return { ok: false, reason: "m5_governance_window_invalid" };
    }
    return isScore(input.priority) &&
      isEntityId(input.stableOwnerId) &&
      isEntityId(input.stableSequence)
      ? { ok: true }
      : { ok: false, reason: "m5_governance_score_invalid" };
  }

  private validateQuery(
    query: M5GovernanceHookQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5GovernanceReason } {
    if (!isIndex(query.policyId, this.policyCapacity))
      return { ok: false, reason: "m5_governance_policy_id_invalid" };
    if (!isUint32(query.expectedOwnerVersion))
      return { ok: false, reason: "m5_governance_source_version_invalid" };
    if (!isUint32(query.tick)) return { ok: false, reason: "m5_governance_window_invalid" };
    if (!isMask(query.hookKindMask, M5_GOVERNANCE_HOOK_MASK_ALL))
      return { ok: false, reason: "m5_governance_query_mask_invalid" };
    if (!isScore(query.minLegitimacyScore))
      return { ok: false, reason: "m5_governance_score_invalid" };
    if (!isRiskFlags(query.blockedRiskFlags))
      return { ok: false, reason: "m5_governance_risk_flags_invalid" };
    if (!isPositive(query.candidateCap) || !isPositive(query.scanCap))
      return { ok: false, reason: "m5_governance_query_cap_invalid" };
    return output.length >= query.candidateCap
      ? { ok: true }
      : { ok: false, reason: "m5_governance_query_output_too_small" };
  }

  private writeHook(input: M5GovernanceHookInput, version: number): void {
    const id = input.hookId;
    this.active[id] = 1;
    this.policyIds[id] = input.policyId;
    this.hookKinds[id] = input.hookKind;
    this.authorityActorIds[id] = input.authorityActorId;
    this.councilPostIds[id] = input.councilPostId;
    this.temporaryPolicyIds[id] = input.temporaryPolicyId;
    this.enforcementCapacities[id] = input.enforcementCapacity;
    this.legitimacySourceIds[id] = input.legitimacySourceId;
    this.legitimacyScores[id] = input.legitimacyScore;
    this.riskFlags[id] = input.riskFlags;
    this.townRuleOwnerVersions[id] = input.townRuleOwnerVersion;
    this.obligationOwnerVersions[id] = input.obligationOwnerVersion;
    this.chronicleOwnerVersions[id] = input.chronicleOwnerVersion;
    this.sourceEvents[id] = input.sourceEventId;
    this.sourceOwnerVersions[id] = input.sourceOwnerVersion;
    this.startsAtTicks[id] = input.startsAtTick;
    this.expiresAtTicks[id] = input.expiresAtTick;
    this.priorities[id] = input.priority;
    this.stableOwnerIds[id] = input.stableOwnerId;
    this.stableSequences[id] = input.stableSequence;
    this.hookVersions[id] = version;
  }

  private hookMatches(hookId: number, query: M5GovernanceHookQuery): boolean {
    const mask = hookKindToMask(this.hookKinds[hookId] ?? 0);
    const start = this.startsAtTicks[hookId] ?? 0;
    const end = this.expiresAtTicks[hookId] ?? 0;
    return (
      (this.active[hookId] ?? 0) === 1 &&
      (mask & query.hookKindMask) !== 0 &&
      start <= query.tick &&
      end >= query.tick
    );
  }

  private linkHook(hookId: number): void {
    const policyId = this.policyIds[hookId] ?? 0;
    let current = this.headsByPolicy[policyId] ?? -1;
    let previous = -1;
    while (current >= 0 && this.hookBefore(current, hookId)) {
      previous = current;
      current = this.nextByHook[current] ?? -1;
    }
    this.previousByHook[hookId] = previous;
    this.nextByHook[hookId] = current;
    if (previous >= 0) this.nextByHook[previous] = hookId;
    else this.headsByPolicy[policyId] = hookId;
    if (current >= 0) this.previousByHook[current] = hookId;
    this.linked[hookId] = 1;
    this.indexedHookCountValue += 1;
  }

  private unlinkHook(hookId: number): void {
    if ((this.linked[hookId] ?? 0) === 0) return;
    const policyId = this.policyIds[hookId] ?? 0;
    const previous = this.previousByHook[hookId] ?? -1;
    const next = this.nextByHook[hookId] ?? -1;
    if (previous >= 0) this.nextByHook[previous] = next;
    else this.headsByPolicy[policyId] = next;
    if (next >= 0) this.previousByHook[next] = previous;
    this.previousByHook[hookId] = -1;
    this.nextByHook[hookId] = -1;
    this.linked[hookId] = 0;
    this.indexedHookCountValue -= 1;
  }

  private incrementKind(kind: number): void {
    this.kindCounts[kind] = (this.kindCounts[kind] ?? 0) + 1;
  }

  private decrementKind(kind: number): void {
    this.kindCounts[kind] = (this.kindCounts[kind] ?? 0) - 1;
  }

  private hookBefore(current: number, next: number): boolean {
    const currentPriority = this.priorities[current] ?? 0;
    const nextPriority = this.priorities[next] ?? 0;
    if (currentPriority !== nextPriority) return currentPriority > nextPriority;
    const currentOwner = this.stableOwnerIds[current] ?? M5_FACTION_GOVERNANCE_NONE;
    const nextOwner = this.stableOwnerIds[next] ?? M5_FACTION_GOVERNANCE_NONE;
    if (currentOwner !== nextOwner) return currentOwner < nextOwner;
    const currentSequence = this.stableSequences[current] ?? M5_FACTION_GOVERNANCE_NONE;
    const nextSequence = this.stableSequences[next] ?? M5_FACTION_GOVERNANCE_NONE;
    return currentSequence !== nextSequence ? currentSequence < nextSequence : current < next;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "m5_governance_owner_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "m5_governance_owner_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private changed(hookId: number, reason: M5GovernanceReason): M5GovernanceMutationResult {
    return { ok: true, changed: true, hookId, ownerVersion: this.ownerVersionValue, reason };
  }
}

export function createM5GovernanceHookStore(
  options: M5GovernanceHookStoreOptions,
): M5GovernanceHookStore {
  return new M5GovernanceHookStore(options);
}

function hookKindToMask(kind: number): number {
  if (kind === M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY)
    return M5_GOVERNANCE_HOOK_MASK_COUNCIL_POST_AUTHORITY;
  if (kind === M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY)
    return M5_GOVERNANCE_HOOK_MASK_TEMPORARY_POLICY_AUTHORITY;
  if (kind === M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY)
    return M5_GOVERNANCE_HOOK_MASK_ENFORCEMENT_CAPACITY;
  if (kind === M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE)
    return M5_GOVERNANCE_HOOK_MASK_LEGITIMACY_SOURCE;
  if (kind === M5_GOVERNANCE_HOOK_RISK_FLAG) return M5_GOVERNANCE_HOOK_MASK_RISK_FLAG;
  return 0;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isEntityId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < M5_FACTION_GOVERNANCE_NONE;
}

function isOptionalEntityId(value: number): boolean {
  return value === M5_FACTION_GOVERNANCE_NONE || isEntityId(value);
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}

function isMask(value: number, allowed: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && (value & ~allowed) === 0;
}

function isRiskFlags(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && (value & ~M5_GOVERNANCE_RISK_FLAG_ALL) === 0;
}

function clampScore(value: number): number {
  return value > 1000 ? 1000 : value;
}

function requirePositive(value: number, label: string): number {
  if (!isPositive(value)) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M5_FACTION_GOVERNANCE_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M5_FACTION_GOVERNANCE_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}
