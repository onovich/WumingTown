import {
  M4_OBLIGATION_NONE,
  M4_OBLIGATION_STATE_ACTIVE,
  M4_OBLIGATION_STATE_FULFILLED,
  M4_OBLIGATION_STATE_VIOLATED,
  m4IsIndexInRange,
  m4IsPositiveSafeInteger,
  m4IsUint32,
  m4RequirePositiveSafeInteger,
  type M4ObligationDueQuery,
  type M4ObligationDueQueryResult,
  type M4ObligationInput,
  type M4ObligationMetrics,
  type M4ObligationMutationResult,
  type M4ObligationReason,
  type M4ObligationStoreOptions,
  type M4ObligationView,
} from "./m4-obligation-types";

export class M4ObligationStore {
  readonly obligationCapacity: number;
  readonly actorCapacity: number;

  private readonly active: Uint8Array;
  private readonly creditors: Uint32Array;
  private readonly debtors: Uint32Array;
  private readonly types: Uint16Array;
  private readonly conditions: Uint16Array;
  private readonly dueStarts: Uint32Array;
  private readonly dueEnds: Uint32Array;
  private readonly visibilities: Uint8Array;
  private readonly inheritanceBases: Uint8Array;
  private readonly fulfillmentActions: Uint16Array;
  private readonly violationConsequences: Uint16Array;
  private readonly sourceEvents: Uint32Array;
  private readonly states: Uint8Array;
  private readonly fulfilledTicks: Uint32Array;
  private readonly violatedTicks: Uint32Array;
  private readonly versions: Uint32Array;
  private readonly dueHeadsByDebtor: Int32Array;
  private readonly dueNext: Int32Array;
  private readonly duePrevious: Int32Array;
  private readonly dueLinked: Uint8Array;
  private activeCountValue = 0;
  private dueIndexedCountValue = 0;
  private fulfilledCountValue = 0;
  private violatedCountValue = 0;
  private lastDueVisits = 0;
  private totalDueVisits = 0;
  private ownerVersionValue = 0;

  constructor(options: M4ObligationStoreOptions) {
    this.obligationCapacity = m4RequirePositiveSafeInteger(
      options.obligationCapacity,
      "obligation capacity",
    );
    this.actorCapacity = m4RequirePositiveSafeInteger(options.actorCapacity, "actor capacity");
    this.active = new Uint8Array(this.obligationCapacity);
    this.creditors = filledUint32(this.obligationCapacity);
    this.debtors = filledUint32(this.obligationCapacity);
    this.types = new Uint16Array(this.obligationCapacity);
    this.conditions = new Uint16Array(this.obligationCapacity);
    this.dueStarts = new Uint32Array(this.obligationCapacity);
    this.dueEnds = new Uint32Array(this.obligationCapacity);
    this.visibilities = new Uint8Array(this.obligationCapacity);
    this.inheritanceBases = new Uint8Array(this.obligationCapacity);
    this.fulfillmentActions = new Uint16Array(this.obligationCapacity);
    this.violationConsequences = new Uint16Array(this.obligationCapacity);
    this.sourceEvents = filledUint32(this.obligationCapacity);
    this.states = new Uint8Array(this.obligationCapacity);
    this.fulfilledTicks = filledUint32(this.obligationCapacity);
    this.violatedTicks = filledUint32(this.obligationCapacity);
    this.versions = new Uint32Array(this.obligationCapacity);
    this.dueHeadsByDebtor = filledInt32(this.actorCapacity);
    this.dueNext = filledInt32(this.obligationCapacity);
    this.duePrevious = filledInt32(this.obligationCapacity);
    this.dueLinked = new Uint8Array(this.obligationCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerObligation(input: M4ObligationInput): M4ObligationMutationResult {
    const valid = this.validateInput(input);
    if (!valid.ok) return valid;
    if ((this.active[input.obligationId] ?? 0) === 1) {
      return { ok: false, reason: "obligation_already_registered" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.active[input.obligationId] = 1;
    this.creditors[input.obligationId] = input.creditorId;
    this.debtors[input.obligationId] = input.debtorId;
    this.types[input.obligationId] = input.obligationType;
    this.conditions[input.obligationId] = input.condition;
    this.dueStarts[input.obligationId] = input.dueStartTick;
    this.dueEnds[input.obligationId] = input.dueEndTick;
    this.visibilities[input.obligationId] = input.visibility;
    this.inheritanceBases[input.obligationId] = input.inheritanceBasis;
    this.fulfillmentActions[input.obligationId] = input.fulfillmentAction;
    this.violationConsequences[input.obligationId] = input.violationConsequence;
    this.sourceEvents[input.obligationId] = input.sourceEventId;
    this.states[input.obligationId] = M4_OBLIGATION_STATE_ACTIVE;
    this.versions[input.obligationId] = nextVersion.ownerVersion;
    this.linkDue(input.obligationId);
    this.activeCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(input.obligationId, "obligation_due_candidates_indexed");
  }

  fulfillObligation(obligationId: number, tick: number): M4ObligationMutationResult {
    const valid = this.validateTerminalChange(obligationId, tick);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.unlinkDue(obligationId);
    this.states[obligationId] = M4_OBLIGATION_STATE_FULFILLED;
    this.fulfilledTicks[obligationId] = tick;
    this.versions[obligationId] = nextVersion.ownerVersion;
    this.activeCountValue -= 1;
    this.fulfilledCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(obligationId, "obligation_fulfilled");
  }

  violateObligation(obligationId: number, tick: number): M4ObligationMutationResult {
    const valid = this.validateTerminalChange(obligationId, tick);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.unlinkDue(obligationId);
    this.states[obligationId] = M4_OBLIGATION_STATE_VIOLATED;
    this.violatedTicks[obligationId] = tick;
    this.versions[obligationId] = nextVersion.ownerVersion;
    this.activeCountValue -= 1;
    this.violatedCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed(obligationId, "obligation_violated");
  }

  queryDueObligations(
    query: M4ObligationDueQuery,
    outputObligationIds: Uint32Array,
  ): M4ObligationDueQueryResult {
    const valid = this.validateQuery(query, outputObligationIds);
    if (!valid.ok) return valid;
    clearOutput(outputObligationIds, query.candidateCap);
    let current = this.dueHeadsByDebtor[query.debtorId] ?? -1;
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
      const dueEnd = this.dueEnds[current] ?? 0;
      const dueStart = this.dueStarts[current] ?? 0;
      if (dueStart <= query.windowEndTick && dueEnd >= query.windowStartTick) {
        if (selected >= query.candidateCap) {
          candidateCapHit = true;
          break;
        }
        outputObligationIds[selected] = current;
        selected += 1;
        if (selected === query.candidateCap) {
          candidateCapHit = (this.dueNext[current] ?? -1) >= 0;
          break;
        }
      }
      current = this.dueNext[current] ?? -1;
    }
    this.lastDueVisits = visited;
    this.totalDueVisits += visited;
    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      candidateCapHit,
      scanCapHit,
      ownerVersion: this.ownerVersionValue,
      reason: scanCapHit
        ? "obligation_due_scan_cap_reached"
        : candidateCapHit
          ? "obligation_due_candidate_cap_reached"
          : selected === 0
            ? "obligation_due_no_candidate"
            : "obligation_due_candidates_indexed",
    };
  }

  readObligation(obligationId: number): M4ObligationView | undefined {
    if (!this.isActive(obligationId)) return undefined;
    return {
      obligationId,
      creditorId: this.creditors[obligationId] ?? M4_OBLIGATION_NONE,
      debtorId: this.debtors[obligationId] ?? M4_OBLIGATION_NONE,
      obligationType: this.types[obligationId] ?? 0,
      condition: this.conditions[obligationId] ?? 0,
      dueStartTick: this.dueStarts[obligationId] ?? 0,
      dueEndTick: this.dueEnds[obligationId] ?? 0,
      visibility: this.visibilities[obligationId] ?? 0,
      inheritanceBasis: this.inheritanceBases[obligationId] ?? 0,
      fulfillmentAction: this.fulfillmentActions[obligationId] ?? 0,
      violationConsequence: this.violationConsequences[obligationId] ?? 0,
      sourceEventId: this.sourceEvents[obligationId] ?? M4_OBLIGATION_NONE,
      state: this.states[obligationId] ?? 0,
      fulfilledTick: this.fulfilledTicks[obligationId] ?? M4_OBLIGATION_NONE,
      violatedTick: this.violatedTicks[obligationId] ?? M4_OBLIGATION_NONE,
      obligationVersion: this.versions[obligationId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  getActiveDueCountForActor(actorId: number, cap: number): number {
    if (!m4IsIndexInRange(actorId, this.actorCapacity) || !m4IsPositiveSafeInteger(cap)) return 0;
    let current = this.dueHeadsByDebtor[actorId] ?? -1;
    let count = 0;
    while (current >= 0 && count < cap) {
      count += 1;
      current = this.dueNext[current] ?? -1;
    }
    return count;
  }

  createMetrics(): M4ObligationMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeCount: this.activeCountValue,
      dueIndexedCount: this.dueIndexedCountValue,
      fulfilledCount: this.fulfilledCountValue,
      violatedCount: this.violatedCountValue,
      lastDueCandidateVisits: this.lastDueVisits,
      totalDueCandidateVisits: this.totalDueVisits,
    };
  }

  private validateInput(
    input: M4ObligationInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ObligationReason } {
    if (
      !m4IsIndexInRange(input.obligationId, this.obligationCapacity) ||
      !m4IsIndexInRange(input.creditorId, this.actorCapacity) ||
      !m4IsIndexInRange(input.debtorId, this.actorCapacity)
    ) {
      return { ok: false, reason: "obligation_id_out_of_range" };
    }
    if (
      input.dueStartTick > input.dueEndTick ||
      !m4IsUint32(input.dueStartTick) ||
      !m4IsUint32(input.dueEndTick)
    ) {
      return { ok: false, reason: "obligation_due_window_invalid" };
    }
    return isSmallPositive(input.obligationType) &&
      isSmallPositive(input.condition) &&
      isSmallPositive(input.visibility) &&
      isSmallPositive(input.inheritanceBasis) &&
      isSmallPositive(input.fulfillmentAction) &&
      isSmallPositive(input.violationConsequence) &&
      m4IsUint32(input.sourceEventId)
      ? { ok: true }
      : { ok: false, reason: "obligation_value_out_of_range" };
  }

  private validateTerminalChange(
    obligationId: number,
    tick: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ObligationReason } {
    if (!this.isActive(obligationId)) return { ok: false, reason: "obligation_not_registered" };
    if ((this.states[obligationId] ?? 0) !== M4_OBLIGATION_STATE_ACTIVE) {
      return { ok: false, reason: "obligation_terminal_state" };
    }
    return m4IsUint32(tick) ? { ok: true } : { ok: false, reason: "obligation_value_out_of_range" };
  }

  private validateQuery(
    query: M4ObligationDueQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ObligationReason } {
    if (!m4IsIndexInRange(query.debtorId, this.actorCapacity))
      return { ok: false, reason: "obligation_id_out_of_range" };
    if (!m4IsPositiveSafeInteger(query.candidateCap))
      return { ok: false, reason: "obligation_candidate_cap_invalid" };
    if (!m4IsPositiveSafeInteger(query.scanCap))
      return { ok: false, reason: "obligation_candidate_cap_invalid" };
    if (output.length < query.candidateCap)
      return { ok: false, reason: "obligation_output_too_small" };
    if (
      !m4IsUint32(query.windowStartTick) ||
      !m4IsUint32(query.windowEndTick) ||
      query.windowStartTick > query.windowEndTick
    ) {
      return { ok: false, reason: "obligation_due_window_invalid" };
    }
    return { ok: true };
  }

  private isActive(obligationId: number): boolean {
    return (
      m4IsIndexInRange(obligationId, this.obligationCapacity) &&
      (this.active[obligationId] ?? 0) === 1
    );
  }

  private linkDue(obligationId: number): void {
    const debtorId = this.debtors[obligationId] ?? 0;
    let current = this.dueHeadsByDebtor[debtorId] ?? -1;
    let previous = -1;
    while (current >= 0 && dueBefore(current, obligationId, this.dueEnds)) {
      previous = current;
      current = this.dueNext[current] ?? -1;
    }
    this.duePrevious[obligationId] = previous;
    this.dueNext[obligationId] = current;
    if (previous >= 0) this.dueNext[previous] = obligationId;
    else this.dueHeadsByDebtor[debtorId] = obligationId;
    if (current >= 0) this.duePrevious[current] = obligationId;
    this.dueLinked[obligationId] = 1;
    this.dueIndexedCountValue += 1;
  }

  private unlinkDue(obligationId: number): void {
    if ((this.dueLinked[obligationId] ?? 0) === 0) return;
    const debtorId = this.debtors[obligationId] ?? 0;
    const previous = this.duePrevious[obligationId] ?? -1;
    const next = this.dueNext[obligationId] ?? -1;
    if (previous >= 0) this.dueNext[previous] = next;
    else this.dueHeadsByDebtor[debtorId] = next;
    if (next >= 0) this.duePrevious[next] = previous;
    this.duePrevious[obligationId] = -1;
    this.dueNext[obligationId] = -1;
    this.dueLinked[obligationId] = 0;
    this.dueIndexedCountValue -= 1;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "obligation_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "obligation_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private changed(obligationId: number, reason: M4ObligationReason): M4ObligationMutationResult {
    return { ok: true, changed: true, obligationId, ownerVersion: this.ownerVersionValue, reason };
  }
}

export function createM4ObligationStore(options: M4ObligationStoreOptions): M4ObligationStore {
  return new M4ObligationStore(options);
}

function dueBefore(current: number, next: number, dueEnds: Uint32Array): boolean {
  const currentEnd = dueEnds[current] ?? 0;
  const nextEnd = dueEnds[next] ?? 0;
  return currentEnd !== nextEnd ? currentEnd < nextEnd : current < next;
}

function isSmallPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M4_OBLIGATION_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M4_OBLIGATION_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}
