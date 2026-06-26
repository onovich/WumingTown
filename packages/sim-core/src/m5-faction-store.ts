import {
  M5_FACTION_FACT_KIND_DEBT_STANCE,
  M5_FACTION_FACT_KIND_FEAR_MEMORY,
  M5_FACTION_FACT_KIND_KNOWN_CLAIM,
  M5_FACTION_FACT_KIND_LEGAL_STANCE,
  M5_FACTION_FACT_KIND_LEGITIMACY,
  M5_FACTION_FACT_KIND_MEMORY_EVENT,
  M5_FACTION_FACT_KIND_TRADE_STANCE,
  M5_FACTION_FACT_MASK_ALL,
  M5_FACTION_FACT_MASK_DEBT_STANCE,
  M5_FACTION_FACT_MASK_FEAR_MEMORY,
  M5_FACTION_FACT_MASK_KNOWN_CLAIM,
  M5_FACTION_FACT_MASK_LEGAL_STANCE,
  M5_FACTION_FACT_MASK_LEGITIMACY,
  M5_FACTION_FACT_MASK_MEMORY_EVENT,
  M5_FACTION_FACT_MASK_TRADE_STANCE,
  M5_FACTION_GOVERNANCE_NONE,
  type M5FactionFactInput,
  type M5FactionFactQuery,
  type M5FactionFactQueryResult,
  type M5FactionFactStoreOptions,
  type M5FactionFactView,
  type M5FactionMetrics,
  type M5FactionMutationResult,
  type M5FactionReason,
} from "./m5-faction-governance-types";

export class M5FactionFactStore {
  readonly factCapacity: number;
  readonly factionCapacity: number;

  private readonly active: Uint8Array;
  private readonly factionIds: Uint32Array;
  private readonly subjectIds: Uint32Array;
  private readonly kinds: Uint8Array;
  private readonly values: Uint16Array;
  private readonly sourceEvents: Uint32Array;
  private readonly sourceOwnerVersions: Uint32Array;
  private readonly chronicleOwnerVersions: Uint32Array;
  private readonly obligationOwnerVersions: Uint32Array;
  private readonly ticks: Uint32Array;
  private readonly priorities: Uint16Array;
  private readonly stableOwnerIds: Uint32Array;
  private readonly stableSequences: Uint32Array;
  private readonly factVersions: Uint32Array;
  private readonly headsByFaction: Int32Array;
  private readonly nextByFact: Int32Array;
  private readonly previousByFact: Int32Array;
  private readonly linked: Uint8Array;
  private readonly kindCounts: Uint32Array;
  private activeFactCountValue = 0;
  private indexedFactCountValue = 0;
  private ownerVersionValue = 0;
  private lastQueryVisitsValue = 0;
  private totalQueryVisitsValue = 0;
  private lastQuerySelectedValue = 0;
  private queryCapHitCountValue = 0;
  private staleBasisRejectCountValue = 0;

  constructor(options: M5FactionFactStoreOptions) {
    this.factCapacity = requirePositive(options.factCapacity, "fact capacity");
    this.factionCapacity = requirePositive(options.factionCapacity, "faction capacity");
    this.active = new Uint8Array(this.factCapacity);
    this.factionIds = filledUint32(this.factCapacity);
    this.subjectIds = filledUint32(this.factCapacity);
    this.kinds = new Uint8Array(this.factCapacity);
    this.values = new Uint16Array(this.factCapacity);
    this.sourceEvents = filledUint32(this.factCapacity);
    this.sourceOwnerVersions = new Uint32Array(this.factCapacity);
    this.chronicleOwnerVersions = new Uint32Array(this.factCapacity);
    this.obligationOwnerVersions = new Uint32Array(this.factCapacity);
    this.ticks = new Uint32Array(this.factCapacity);
    this.priorities = new Uint16Array(this.factCapacity);
    this.stableOwnerIds = filledUint32(this.factCapacity);
    this.stableSequences = filledUint32(this.factCapacity);
    this.factVersions = new Uint32Array(this.factCapacity);
    this.headsByFaction = filledInt32(this.factionCapacity);
    this.nextByFact = filledInt32(this.factCapacity);
    this.previousByFact = filledInt32(this.factCapacity);
    this.linked = new Uint8Array(this.factCapacity);
    this.kindCounts = new Uint32Array(M5_FACTION_FACT_KIND_KNOWN_CLAIM + 1);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  upsertFact(input: M5FactionFactInput): M5FactionMutationResult {
    const valid = this.validateInput(input);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    const wasActive = (this.active[input.factId] ?? 0) === 1;
    if (wasActive) {
      this.unlinkFact(input.factId);
      this.decrementKind(this.kinds[input.factId] ?? 0);
    } else {
      this.activeFactCountValue += 1;
    }
    this.writeFact(input, nextVersion.ownerVersion);
    this.incrementKind(input.kind);
    this.linkFact(input.factId);
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(input.factId, "m5_faction_fact_indexed");
  }

  queryFacts(query: M5FactionFactQuery, outputFactIds: Uint32Array): M5FactionFactQueryResult {
    const valid = this.validateQuery(query, outputFactIds);
    if (!valid.ok) return valid;
    if (query.expectedOwnerVersion !== this.ownerVersionValue) {
      this.staleBasisRejectCountValue += 1;
      return { ok: false, reason: "m5_faction_query_stale_basis" };
    }
    clearOutput(outputFactIds, query.candidateCap);
    let current = this.headsByFaction[query.factionId] ?? -1;
    let visited = 0;
    let selected = 0;
    let candidateCapHit = false;
    let scanCapHit = false;
    while (current >= 0) {
      if (visited >= query.scanCap) {
        scanCapHit = true;
        break;
      }
      visited += 1;
      if (this.factMatches(current, query)) {
        if (selected >= query.candidateCap) {
          candidateCapHit = true;
          break;
        }
        outputFactIds[selected] = current;
        selected += 1;
      }
      current = this.nextByFact[current] ?? -1;
    }
    this.lastQueryVisitsValue = visited;
    this.totalQueryVisitsValue += visited;
    this.lastQuerySelectedValue = selected;
    if (candidateCapHit || scanCapHit) this.queryCapHitCountValue += 1;
    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      candidateCapHit,
      scanCapHit,
      ownerVersion: this.ownerVersionValue,
      reason: scanCapHit
        ? "m5_faction_query_scan_cap_reached"
        : candidateCapHit
          ? "m5_faction_query_cap_reached"
          : selected === 0
            ? "m5_faction_query_no_candidate"
            : "m5_faction_query_indexed",
    };
  }

  readFact(factId: number): M5FactionFactView | undefined {
    if (!isIndex(factId, this.factCapacity) || (this.active[factId] ?? 0) === 0) return undefined;
    return {
      factId,
      factionId: this.factionIds[factId] ?? M5_FACTION_GOVERNANCE_NONE,
      subjectId: this.subjectIds[factId] ?? M5_FACTION_GOVERNANCE_NONE,
      kind: this.kinds[factId] ?? 0,
      value: this.values[factId] ?? 0,
      sourceEventId: this.sourceEvents[factId] ?? M5_FACTION_GOVERNANCE_NONE,
      sourceOwnerVersion: this.sourceOwnerVersions[factId] ?? 0,
      chronicleOwnerVersion: this.chronicleOwnerVersions[factId] ?? 0,
      obligationOwnerVersion: this.obligationOwnerVersions[factId] ?? 0,
      tick: this.ticks[factId] ?? 0,
      priority: this.priorities[factId] ?? 0,
      stableOwnerId: this.stableOwnerIds[factId] ?? M5_FACTION_GOVERNANCE_NONE,
      stableSequence: this.stableSequences[factId] ?? M5_FACTION_GOVERNANCE_NONE,
      factVersion: this.factVersions[factId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  createMetrics(): M5FactionMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeFactCount: this.activeFactCountValue,
      indexedFactCount: this.indexedFactCountValue,
      legalFactCount: this.kindCounts[M5_FACTION_FACT_KIND_LEGAL_STANCE] ?? 0,
      tradeFactCount: this.kindCounts[M5_FACTION_FACT_KIND_TRADE_STANCE] ?? 0,
      debtFactCount: this.kindCounts[M5_FACTION_FACT_KIND_DEBT_STANCE] ?? 0,
      legitimacyFactCount: this.kindCounts[M5_FACTION_FACT_KIND_LEGITIMACY] ?? 0,
      fearMemoryFactCount: this.kindCounts[M5_FACTION_FACT_KIND_FEAR_MEMORY] ?? 0,
      memoryEventFactCount: this.kindCounts[M5_FACTION_FACT_KIND_MEMORY_EVENT] ?? 0,
      knownClaimFactCount: this.kindCounts[M5_FACTION_FACT_KIND_KNOWN_CLAIM] ?? 0,
      lastQueryVisits: this.lastQueryVisitsValue,
      totalQueryVisits: this.totalQueryVisitsValue,
      lastQuerySelected: this.lastQuerySelectedValue,
      queryCapHitCount: this.queryCapHitCountValue,
      staleBasisRejectCount: this.staleBasisRejectCountValue,
    };
  }

  private validateInput(
    input: M5FactionFactInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5FactionReason } {
    if (!isIndex(input.factId, this.factCapacity))
      return { ok: false, reason: "m5_faction_fact_id_out_of_range" };
    if (!isIndex(input.factionId, this.factionCapacity))
      return { ok: false, reason: "m5_faction_faction_id_out_of_range" };
    if (!isEntityId(input.subjectId)) return { ok: false, reason: "m5_faction_subject_id_invalid" };
    if (kindToMask(input.kind) === 0) return { ok: false, reason: "m5_faction_kind_invalid" };
    if (!isScore(input.value) || !isScore(input.priority))
      return { ok: false, reason: "m5_faction_value_invalid" };
    if (!isEntityId(input.sourceEventId))
      return { ok: false, reason: "m5_faction_source_event_invalid" };
    if (
      !isPositiveUint32(input.sourceOwnerVersion) ||
      !isPositiveUint32(input.chronicleOwnerVersion) ||
      !isPositiveUint32(input.obligationOwnerVersion)
    ) {
      return { ok: false, reason: "m5_faction_source_version_invalid" };
    }
    return isUint32(input.tick) &&
      isEntityId(input.stableOwnerId) &&
      isEntityId(input.stableSequence)
      ? { ok: true }
      : { ok: false, reason: "m5_faction_value_invalid" };
  }

  private validateQuery(
    query: M5FactionFactQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5FactionReason } {
    if (!isIndex(query.factionId, this.factionCapacity))
      return { ok: false, reason: "m5_faction_faction_id_out_of_range" };
    if (!isUint32(query.expectedOwnerVersion))
      return { ok: false, reason: "m5_faction_source_version_invalid" };
    if (!isEntityId(query.subjectId) && query.subjectId !== M5_FACTION_GOVERNANCE_NONE)
      return { ok: false, reason: "m5_faction_subject_id_invalid" };
    if (!isMask(query.kindMask, M5_FACTION_FACT_MASK_ALL))
      return { ok: false, reason: "m5_faction_query_mask_invalid" };
    if (!isScore(query.minValue)) return { ok: false, reason: "m5_faction_value_invalid" };
    if (!isPositive(query.candidateCap) || !isPositive(query.scanCap))
      return { ok: false, reason: "m5_faction_query_cap_invalid" };
    return output.length >= query.candidateCap
      ? { ok: true }
      : { ok: false, reason: "m5_faction_query_output_too_small" };
  }

  private writeFact(input: M5FactionFactInput, version: number): void {
    const id = input.factId;
    this.active[id] = 1;
    this.factionIds[id] = input.factionId;
    this.subjectIds[id] = input.subjectId;
    this.kinds[id] = input.kind;
    this.values[id] = input.value;
    this.sourceEvents[id] = input.sourceEventId;
    this.sourceOwnerVersions[id] = input.sourceOwnerVersion;
    this.chronicleOwnerVersions[id] = input.chronicleOwnerVersion;
    this.obligationOwnerVersions[id] = input.obligationOwnerVersion;
    this.ticks[id] = input.tick;
    this.priorities[id] = input.priority;
    this.stableOwnerIds[id] = input.stableOwnerId;
    this.stableSequences[id] = input.stableSequence;
    this.factVersions[id] = version;
  }

  private factMatches(factId: number, query: M5FactionFactQuery): boolean {
    const subjectId = this.subjectIds[factId] ?? M5_FACTION_GOVERNANCE_NONE;
    const kind = this.kinds[factId] ?? 0;
    const mask = kindToMask(kind);
    return (
      (this.active[factId] ?? 0) === 1 &&
      (query.subjectId === M5_FACTION_GOVERNANCE_NONE || subjectId === query.subjectId) &&
      (mask & query.kindMask) !== 0 &&
      (this.values[factId] ?? 0) >= query.minValue
    );
  }

  private linkFact(factId: number): void {
    const factionId = this.factionIds[factId] ?? 0;
    let current = this.headsByFaction[factionId] ?? -1;
    let previous = -1;
    while (current >= 0 && this.factBefore(current, factId)) {
      previous = current;
      current = this.nextByFact[current] ?? -1;
    }
    this.previousByFact[factId] = previous;
    this.nextByFact[factId] = current;
    if (previous >= 0) this.nextByFact[previous] = factId;
    else this.headsByFaction[factionId] = factId;
    if (current >= 0) this.previousByFact[current] = factId;
    this.linked[factId] = 1;
    this.indexedFactCountValue += 1;
  }

  private unlinkFact(factId: number): void {
    if ((this.linked[factId] ?? 0) === 0) return;
    const factionId = this.factionIds[factId] ?? 0;
    const previous = this.previousByFact[factId] ?? -1;
    const next = this.nextByFact[factId] ?? -1;
    if (previous >= 0) this.nextByFact[previous] = next;
    else this.headsByFaction[factionId] = next;
    if (next >= 0) this.previousByFact[next] = previous;
    this.previousByFact[factId] = -1;
    this.nextByFact[factId] = -1;
    this.linked[factId] = 0;
    this.indexedFactCountValue -= 1;
  }

  private incrementKind(kind: number): void {
    this.kindCounts[kind] = (this.kindCounts[kind] ?? 0) + 1;
  }

  private decrementKind(kind: number): void {
    this.kindCounts[kind] = (this.kindCounts[kind] ?? 0) - 1;
  }

  private factBefore(current: number, next: number): boolean {
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
    | { readonly ok: false; readonly reason: "m5_faction_owner_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "m5_faction_owner_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private changed(factId: number, reason: M5FactionReason): M5FactionMutationResult {
    return { ok: true, changed: true, factId, ownerVersion: this.ownerVersionValue, reason };
  }
}

export function createM5FactionFactStore(options: M5FactionFactStoreOptions): M5FactionFactStore {
  return new M5FactionFactStore(options);
}

function kindToMask(kind: number): number {
  if (kind === M5_FACTION_FACT_KIND_LEGAL_STANCE) return M5_FACTION_FACT_MASK_LEGAL_STANCE;
  if (kind === M5_FACTION_FACT_KIND_TRADE_STANCE) return M5_FACTION_FACT_MASK_TRADE_STANCE;
  if (kind === M5_FACTION_FACT_KIND_DEBT_STANCE) return M5_FACTION_FACT_MASK_DEBT_STANCE;
  if (kind === M5_FACTION_FACT_KIND_LEGITIMACY) return M5_FACTION_FACT_MASK_LEGITIMACY;
  if (kind === M5_FACTION_FACT_KIND_FEAR_MEMORY) return M5_FACTION_FACT_MASK_FEAR_MEMORY;
  if (kind === M5_FACTION_FACT_KIND_MEMORY_EVENT) return M5_FACTION_FACT_MASK_MEMORY_EVENT;
  if (kind === M5_FACTION_FACT_KIND_KNOWN_CLAIM) return M5_FACTION_FACT_MASK_KNOWN_CLAIM;
  return 0;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isEntityId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < M5_FACTION_GOVERNANCE_NONE;
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
