import {
  M5_SEASON_COMMAND_ARCHIVE_REPAIR_OPPORTUNITY,
  M5_SEASON_COMMAND_BRIDGE_ROUTE_OPPORTUNITY,
  M5_SEASON_COMMAND_MARKET_NIGHT_OPPORTUNITY,
  M5_SEASON_COMMAND_REGISTRATION_OPPORTUNITY,
  M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
  M5_SEASON_COMMAND_SCHEDULE_EVENT,
  M5_SEASON_EVENT_KIND_INCIDENT,
  M5_SEASON_EVENT_KIND_RECOVERY,
  M5_SEASON_EVENT_NONE,
  M5_SEASON_EVENT_POOL_FIRST_SEASON,
  M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK,
  M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE,
  M5_SEASON_EVENT_THEME_MARKET_NIGHT,
  M5_SEASON_EVENT_THEME_REGISTRATION_PRESSURE,
  M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE,
  M5_SEASON_PRECONDITION_ALL,
  M5_SEASON_RECOVERY_ARCHIVE,
  M5_SEASON_RECOVERY_BRIDGE_ROUTE,
  M5_SEASON_RECOVERY_MARKET,
  M5_SEASON_RECOVERY_NONE,
  M5_SEASON_RECOVERY_REGISTRATION,
  M5_SEASON_RECOVERY_RESOURCE,
  type M5SeasonEventCandidateInput,
  type M5SeasonEventCandidateView,
  type M5SeasonEventMetrics,
  type M5SeasonEventMutationResult,
  type M5SeasonEventPoolStoreOptions,
  type M5SeasonEventReason,
  type M5SeasonEventSelectionQuery,
  type M5SeasonEventSelectionResult,
  type M5SeasonPreconditionFailureView,
  type M5SeasonRecoveryWindowInput,
  type M5SeasonRecoveryWindowView,
} from "./m5-season-events-types";

const RECOVERY_TYPE_SLOT_COUNT = M5_SEASON_RECOVERY_ARCHIVE + 1;
const THEME_SLOT_COUNT = M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK + 1;

export class M5SeasonEventPoolStore {
  readonly candidateCapacity: number;
  readonly cooldownCapacity: number;
  readonly recoveryWindowCapacity: number;
  readonly preconditionFailureCapacity: number;

  private readonly candidateActive: Uint8Array;
  private readonly poolIds: Uint16Array;
  private readonly candidateKinds: Uint8Array;
  private readonly themes: Uint8Array;
  private readonly recoveryTypes: Uint8Array;
  private readonly scores: Uint16Array;
  private readonly priorities: Uint16Array;
  private readonly cooldownKeys: Uint32Array;
  private readonly cooldownTicks: Uint32Array;
  private readonly freshnessWindowTicks: Uint32Array;
  private readonly commandKinds: Uint16Array;
  private readonly commandTargets: Uint32Array;
  private readonly sourceEventDefs: Uint32Array;
  private readonly anomalyVersions: Uint32Array;
  private readonly factionVersions: Uint32Array;
  private readonly governanceVersions: Uint32Array;
  private readonly seasonVersions: Uint32Array;
  private readonly resourceVersions: Uint32Array;
  private readonly recoveryBasisVersions: Uint32Array;
  private readonly availableTicks: Uint32Array;
  private readonly expiresTicks: Uint32Array;
  private readonly preconditionMasks: Uint16Array;
  private readonly stableOwnerIds: Uint32Array;
  private readonly stableSequences: Uint32Array;
  private readonly candidateVersions: Uint32Array;
  private readonly candidateNext: Int32Array;
  private readonly candidatePrevious: Int32Array;
  private readonly recoveryHeads: Int32Array;
  private incidentHead = -1;

  private readonly cooldownUntilTicks: Uint32Array;
  private readonly cooldownVersions: Uint32Array;
  private readonly themeFreshnessTicks: Uint32Array;

  private readonly windowActive: Uint8Array;
  private readonly windowRecoveryTypes: Uint8Array;
  private readonly windowStartTicks: Uint32Array;
  private readonly windowEndTicks: Uint32Array;
  private readonly windowCandidateVersions: Uint32Array;
  private readonly windowVersions: Uint32Array;
  private activeRecoveryWindowId = M5_SEASON_EVENT_NONE;

  private readonly failureSequences: Uint32Array;
  private readonly failureTicks: Uint32Array;
  private readonly failureCandidateIds: Uint32Array;
  private readonly failureMissingMasks: Uint16Array;
  private readonly failureReasonCodes: Uint8Array;
  private readonly failureOwnerVersions: Uint32Array;
  private failureCursor = 0;
  private failureStored = 0;
  private nextFailureSequence = 1;

  private ownerVersionValue = 0;
  private activeIncidentCount = 0;
  private activeRecoveryCount = 0;
  private recoveryWindowCount = 0;
  private selectionCount = 0;
  private lastCandidateVisits = 0;
  private totalCandidateVisits = 0;
  private cooldownWriteCount = 0;
  private eventFreshnessWriteCount = 0;
  private preconditionFailureCount = 0;

  constructor(options: M5SeasonEventPoolStoreOptions) {
    this.candidateCapacity = requirePositive(options.candidateCapacity, "candidate capacity");
    this.cooldownCapacity = requirePositive(options.cooldownCapacity, "cooldown capacity");
    this.recoveryWindowCapacity = requirePositive(
      options.recoveryWindowCapacity,
      "recovery window capacity",
    );
    this.preconditionFailureCapacity = requirePositive(
      options.preconditionFailureCapacity,
      "precondition failure capacity",
    );
    this.candidateActive = new Uint8Array(this.candidateCapacity);
    this.poolIds = new Uint16Array(this.candidateCapacity);
    this.candidateKinds = new Uint8Array(this.candidateCapacity);
    this.themes = new Uint8Array(this.candidateCapacity);
    this.recoveryTypes = new Uint8Array(this.candidateCapacity);
    this.scores = new Uint16Array(this.candidateCapacity);
    this.priorities = new Uint16Array(this.candidateCapacity);
    this.cooldownKeys = filledUint32(this.candidateCapacity);
    this.cooldownTicks = new Uint32Array(this.candidateCapacity);
    this.freshnessWindowTicks = new Uint32Array(this.candidateCapacity);
    this.commandKinds = new Uint16Array(this.candidateCapacity);
    this.commandTargets = filledUint32(this.candidateCapacity);
    this.sourceEventDefs = filledUint32(this.candidateCapacity);
    this.anomalyVersions = new Uint32Array(this.candidateCapacity);
    this.factionVersions = new Uint32Array(this.candidateCapacity);
    this.governanceVersions = new Uint32Array(this.candidateCapacity);
    this.seasonVersions = new Uint32Array(this.candidateCapacity);
    this.resourceVersions = new Uint32Array(this.candidateCapacity);
    this.recoveryBasisVersions = new Uint32Array(this.candidateCapacity);
    this.availableTicks = filledUint32(this.candidateCapacity);
    this.expiresTicks = filledUint32(this.candidateCapacity);
    this.preconditionMasks = new Uint16Array(this.candidateCapacity);
    this.stableOwnerIds = filledUint32(this.candidateCapacity);
    this.stableSequences = filledUint32(this.candidateCapacity);
    this.candidateVersions = new Uint32Array(this.candidateCapacity);
    this.candidateNext = filledInt32(this.candidateCapacity);
    this.candidatePrevious = filledInt32(this.candidateCapacity);
    this.recoveryHeads = filledInt32(RECOVERY_TYPE_SLOT_COUNT);
    this.cooldownUntilTicks = new Uint32Array(this.cooldownCapacity);
    this.cooldownVersions = new Uint32Array(this.cooldownCapacity);
    this.themeFreshnessTicks = filledUint32(THEME_SLOT_COUNT);
    this.windowActive = new Uint8Array(this.recoveryWindowCapacity);
    this.windowRecoveryTypes = new Uint8Array(this.recoveryWindowCapacity);
    this.windowStartTicks = filledUint32(this.recoveryWindowCapacity);
    this.windowEndTicks = filledUint32(this.recoveryWindowCapacity);
    this.windowCandidateVersions = new Uint32Array(this.recoveryWindowCapacity);
    this.windowVersions = new Uint32Array(this.recoveryWindowCapacity);
    this.failureSequences = new Uint32Array(this.preconditionFailureCapacity);
    this.failureTicks = filledUint32(this.preconditionFailureCapacity);
    this.failureCandidateIds = filledUint32(this.preconditionFailureCapacity);
    this.failureMissingMasks = new Uint16Array(this.preconditionFailureCapacity);
    this.failureReasonCodes = new Uint8Array(this.preconditionFailureCapacity);
    this.failureOwnerVersions = new Uint32Array(this.preconditionFailureCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerCandidate(input: M5SeasonEventCandidateInput): M5SeasonEventMutationResult {
    const valid = this.validateCandidate(input);
    if (!valid.ok) return valid;
    if ((this.candidateActive[input.candidateId] ?? 0) === 1) {
      return { ok: false, reason: "m5_season_event_candidate_already_registered" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.writeCandidate(input, nextVersion.ownerVersion);
    this.linkCandidate(input.candidateId);
    if (input.candidateKind === M5_SEASON_EVENT_KIND_INCIDENT) this.activeIncidentCount += 1;
    else this.activeRecoveryCount += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed("m5_season_event_candidate_registered");
  }

  openRecoveryWindow(input: M5SeasonRecoveryWindowInput): M5SeasonEventMutationResult {
    const valid = this.validateRecoveryWindow(input);
    if (!valid.ok) return valid;
    if ((this.windowActive[input.windowId] ?? 0) === 1) {
      return { ok: false, reason: "m5_season_event_recovery_window_already_open" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.windowActive[input.windowId] = 1;
    this.windowRecoveryTypes[input.windowId] = input.recoveryType;
    this.windowStartTicks[input.windowId] = input.startTick;
    this.windowEndTicks[input.windowId] = input.endTick;
    this.windowCandidateVersions[input.windowId] = input.sourceCandidateVersion;
    this.windowVersions[input.windowId] = nextVersion.ownerVersion;
    this.activeRecoveryWindowId = input.windowId;
    this.recoveryWindowCount += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed("m5_season_event_recovery_window_opened");
  }

  selectEvent(
    query: M5SeasonEventSelectionQuery,
    outputCandidateIds: Uint32Array,
  ): M5SeasonEventSelectionResult {
    const valid = validateSelectionQuery(query, outputCandidateIds);
    if (!valid.ok) return valid;
    if (query.expectedPoolVersion !== this.ownerVersionValue) {
      return { ok: false, reason: "m5_season_event_query_stale_basis" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return { ok: false, reason: nextVersion.reason };
    clearOutput(outputCandidateIds, query.selectedCap);
    const recoveryWindowId = this.getActiveRecoveryWindowId(query.tick);
    const recoveryActive = recoveryWindowId !== M5_SEASON_EVENT_NONE;
    const recoveryType = recoveryActive
      ? (this.windowRecoveryTypes[recoveryWindowId] ?? M5_SEASON_RECOVERY_NONE)
      : M5_SEASON_RECOVERY_NONE;
    const head = recoveryActive ? (this.recoveryHeads[recoveryType] ?? -1) : this.incidentHead;
    const selection = this.collectCandidates(
      head,
      query,
      recoveryActive,
      nextVersion.ownerVersion,
      outputCandidateIds,
    );
    this.lastCandidateVisits = selection.visitedCount;
    this.totalCandidateVisits += selection.visitedCount;
    const selected = this.chooseCandidate(selection.selectedCount, query, outputCandidateIds);
    const reason = this.selectionReason(selected.selectedCandidateId, selection, recoveryActive);
    if (selected.selectedCandidateId !== M5_SEASON_EVENT_NONE) {
      this.applyCooldown(selected.selectedCandidateId, query.tick, nextVersion.ownerVersion);
      this.applyFreshness(selected.selectedCandidateId, query.tick);
    }
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.selectionCount += 1;
    return this.createSelectionResult(selection, selected, recoveryActive, reason);
  }

  readCandidate(candidateId: number): M5SeasonEventCandidateView | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    ) {
      return undefined;
    }
    return {
      candidateId,
      poolId: this.poolIds[candidateId] ?? 0,
      candidateKind: this.candidateKinds[candidateId] ?? 0,
      theme: this.themes[candidateId] ?? 0,
      recoveryType: this.recoveryTypes[candidateId] ?? 0,
      score: this.scores[candidateId] ?? 0,
      priority: this.priorities[candidateId] ?? 0,
      cooldownKey: this.cooldownKeys[candidateId] ?? M5_SEASON_EVENT_NONE,
      cooldownTicks: this.cooldownTicks[candidateId] ?? 0,
      freshnessWindowTicks: this.freshnessWindowTicks[candidateId] ?? 0,
      commandKind: this.commandKinds[candidateId] ?? 0,
      commandTargetId: this.commandTargets[candidateId] ?? M5_SEASON_EVENT_NONE,
      sourceEventDefId: this.sourceEventDefs[candidateId] ?? M5_SEASON_EVENT_NONE,
      anomalyOwnerVersion: this.anomalyVersions[candidateId] ?? 0,
      factionOwnerVersion: this.factionVersions[candidateId] ?? 0,
      governanceOwnerVersion: this.governanceVersions[candidateId] ?? 0,
      seasonOwnerVersion: this.seasonVersions[candidateId] ?? 0,
      resourceOwnerVersion: this.resourceVersions[candidateId] ?? 0,
      recoveryBasisVersion: this.recoveryBasisVersions[candidateId] ?? 0,
      availableTick: this.availableTicks[candidateId] ?? M5_SEASON_EVENT_NONE,
      expiresTick: this.expiresTicks[candidateId] ?? M5_SEASON_EVENT_NONE,
      preconditionMask: this.preconditionMasks[candidateId] ?? 0,
      stableOwnerId: this.stableOwnerIds[candidateId] ?? M5_SEASON_EVENT_NONE,
      stableSequence: this.stableSequences[candidateId] ?? M5_SEASON_EVENT_NONE,
      candidateVersion: this.candidateVersions[candidateId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readRecoveryWindow(windowId: number): M5SeasonRecoveryWindowView | undefined {
    if (
      !isIndex(windowId, this.recoveryWindowCapacity) ||
      (this.windowActive[windowId] ?? 0) === 0
    ) {
      return undefined;
    }
    return {
      windowId,
      recoveryType: this.windowRecoveryTypes[windowId] ?? 0,
      startTick: this.windowStartTicks[windowId] ?? M5_SEASON_EVENT_NONE,
      endTick: this.windowEndTicks[windowId] ?? M5_SEASON_EVENT_NONE,
      sourceCandidateVersion: this.windowCandidateVersions[windowId] ?? 0,
      active: 0,
      windowVersion: this.windowVersions[windowId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readPreconditionFailure(ageFromNewest: number): M5SeasonPreconditionFailureView | undefined {
    if (!isIndex(ageFromNewest, this.failureStored)) return undefined;
    const slot =
      (this.failureCursor + this.preconditionFailureCapacity - 1 - ageFromNewest) %
      this.preconditionFailureCapacity;
    return {
      sequence: this.failureSequences[slot] ?? 0,
      tick: this.failureTicks[slot] ?? M5_SEASON_EVENT_NONE,
      candidateId: this.failureCandidateIds[slot] ?? M5_SEASON_EVENT_NONE,
      missingPreconditionMask: this.failureMissingMasks[slot] ?? 0,
      reason: decodeReason(this.failureReasonCodes[slot] ?? 0),
      ownerVersion: this.failureOwnerVersions[slot] ?? 0,
    };
  }

  isRecoveryWindowActive(windowId: number, tick: number): boolean {
    return (
      isIndex(windowId, this.recoveryWindowCapacity) &&
      this.getActiveRecoveryWindowId(tick) === windowId
    );
  }

  createMetrics(): M5SeasonEventMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeIncidentCandidateCount: this.activeIncidentCount,
      activeRecoveryCandidateCount: this.activeRecoveryCount,
      recoveryWindowCount: this.recoveryWindowCount,
      activeRecoveryWindowId: this.activeRecoveryWindowId,
      selectionCount: this.selectionCount,
      lastCandidateVisits: this.lastCandidateVisits,
      totalCandidateVisits: this.totalCandidateVisits,
      cooldownWriteCount: this.cooldownWriteCount,
      eventFreshnessWriteCount: this.eventFreshnessWriteCount,
      preconditionFailureCount: this.preconditionFailureCount,
      preconditionFailureStoredCount: this.failureStored,
      nextPreconditionFailureSequence: this.nextFailureSequence,
    };
  }

  private collectCandidates(
    head: number,
    query: M5SeasonEventSelectionQuery,
    recoveryActive: boolean,
    ownerVersion: number,
    output: Uint32Array,
  ): SelectionScratch {
    let current = head;
    let visitedCount = 0;
    let selectedCount = 0;
    let rejectedCooldownCount = 0;
    let rejectedPreconditionCount = 0;
    let rejectedFreshnessCount = 0;
    let rejectedTimeCount = 0;
    let candidateCapHit = false;
    let selectedCapHit = false;
    while (current >= 0) {
      if (visitedCount >= query.candidateCap) {
        candidateCapHit = true;
        break;
      }
      visitedCount += 1;
      if (!this.isTimeEligible(current, query.tick)) {
        rejectedTimeCount += 1;
      } else if (this.isCooldownActive(current, query.tick)) {
        rejectedCooldownCount += 1;
      } else if (this.missingPreconditions(current, query) !== 0) {
        rejectedPreconditionCount += 1;
        this.recordPreconditionFailure(current, query, ownerVersion);
      } else if (!recoveryActive && this.isFreshnessActive(current, query.tick)) {
        rejectedFreshnessCount += 1;
      } else if (selectedCount < query.selectedCap) {
        output[selectedCount] = current;
        selectedCount += 1;
      } else {
        selectedCapHit = true;
      }
      current = this.candidateNext[current] ?? -1;
    }
    return {
      visitedCount,
      selectedCount,
      rejectedCooldownCount,
      rejectedPreconditionCount,
      rejectedFreshnessCount,
      rejectedTimeCount,
      candidateCapHit,
      selectedCapHit,
    };
  }

  private chooseCandidate(
    selectedCount: number,
    query: M5SeasonEventSelectionQuery,
    output: Uint32Array,
  ): {
    readonly selectedCandidateId: number;
    readonly randomChoiceIndex: number;
    readonly randomDraw: number;
  } {
    if (selectedCount === 0) {
      return {
        selectedCandidateId: M5_SEASON_EVENT_NONE,
        randomChoiceIndex: M5_SEASON_EVENT_NONE,
        randomDraw: 0,
      };
    }
    const draw = query.randomStreams.nextUint32(query.streamName);
    const choiceIndex = draw % selectedCount;
    return {
      selectedCandidateId: output[choiceIndex] ?? M5_SEASON_EVENT_NONE,
      randomChoiceIndex: choiceIndex,
      randomDraw: draw,
    };
  }

  private createSelectionResult(
    selection: SelectionScratch,
    selected: {
      readonly selectedCandidateId: number;
      readonly randomChoiceIndex: number;
      readonly randomDraw: number;
    },
    recoveryActive: boolean,
    reason: M5SeasonEventReason,
  ): M5SeasonEventSelectionResult {
    return {
      ok: true,
      selectedCount: selection.selectedCount,
      visitedCount: selection.visitedCount,
      rejectedCooldownCount: selection.rejectedCooldownCount,
      rejectedPreconditionCount: selection.rejectedPreconditionCount,
      rejectedFreshnessCount: selection.rejectedFreshnessCount,
      rejectedTimeCount: selection.rejectedTimeCount,
      candidateCapHit: selection.candidateCapHit,
      selectedCapHit: selection.selectedCapHit,
      recoveryWindowActive: recoveryActive,
      selectedCandidateId: selected.selectedCandidateId,
      selectedCommandKind:
        selected.selectedCandidateId === M5_SEASON_EVENT_NONE
          ? 0
          : (this.commandKinds[selected.selectedCandidateId] ?? 0),
      selectedCommandTargetId:
        selected.selectedCandidateId === M5_SEASON_EVENT_NONE
          ? M5_SEASON_EVENT_NONE
          : (this.commandTargets[selected.selectedCandidateId] ?? M5_SEASON_EVENT_NONE),
      selectedRecoveryType:
        selected.selectedCandidateId === M5_SEASON_EVENT_NONE
          ? M5_SEASON_RECOVERY_NONE
          : (this.recoveryTypes[selected.selectedCandidateId] ?? M5_SEASON_RECOVERY_NONE),
      randomChoiceIndex: selected.randomChoiceIndex,
      randomDraw: selected.randomDraw,
      ownerVersion: this.ownerVersionValue,
      reason,
    };
  }

  private selectionReason(
    selectedCandidateId: number,
    selection: SelectionScratch,
    recoveryActive: boolean,
  ): M5SeasonEventReason {
    if (selectedCandidateId !== M5_SEASON_EVENT_NONE) {
      return recoveryActive
        ? "m5_season_event_recovery_selected"
        : "m5_season_event_incident_selected";
    }
    if (selection.rejectedCooldownCount > 0) return "m5_season_event_cooldown_active";
    if (selection.rejectedPreconditionCount > 0) return "m5_season_event_precondition_failed";
    if (selection.rejectedFreshnessCount > 0) return "m5_season_event_freshness_rejected";
    if (selection.rejectedTimeCount > 0) return "m5_season_event_time_rejected";
    if (recoveryActive && this.activeRecoveryCount > 0 && selection.visitedCount === 0)
      return "m5_season_event_wrong_recovery_type";
    if (recoveryActive) return "m5_season_event_recovery_window_active";
    if (selection.candidateCapHit) return "m5_season_event_candidate_cap_reached";
    if (selection.selectedCapHit) return "m5_season_event_selected_cap_reached";
    return "m5_season_event_no_candidate";
  }

  private validateCandidate(
    input: M5SeasonEventCandidateInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5SeasonEventReason } {
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "m5_season_event_id_out_of_range" };
    if (input.poolId !== M5_SEASON_EVENT_POOL_FIRST_SEASON)
      return { ok: false, reason: "m5_season_event_pool_id_invalid" };
    if (!isCandidateKind(input.candidateKind) || !isTheme(input.theme))
      return { ok: false, reason: "m5_season_event_value_out_of_range" };
    if (!isRecoveryTypeForKind(input.candidateKind, input.recoveryType))
      return { ok: false, reason: "m5_season_event_value_out_of_range" };
    if (!isLegalCommand(input)) return { ok: false, reason: "m5_season_event_value_out_of_range" };
    if (
      !isScore(input.score) ||
      !isScore(input.priority) ||
      !isCooldownKey(input.cooldownKey, this.cooldownCapacity)
    ) {
      return { ok: false, reason: "m5_season_event_value_out_of_range" };
    }
    return this.validateCandidateBasis(input);
  }

  private validateCandidateBasis(
    input: M5SeasonEventCandidateInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5SeasonEventReason } {
    if (
      !isPositiveUint32(input.anomalyOwnerVersion) ||
      !isPositiveUint32(input.factionOwnerVersion) ||
      !isPositiveUint32(input.governanceOwnerVersion) ||
      !isPositiveUint32(input.seasonOwnerVersion) ||
      !isPositiveUint32(input.resourceOwnerVersion) ||
      !isPositiveUint32(input.recoveryBasisVersion)
    ) {
      return { ok: false, reason: "m5_season_event_basis_version_invalid" };
    }
    if (
      !isEntityId(input.commandTargetId) ||
      !isEntityId(input.sourceEventDefId) ||
      !isUint32(input.cooldownTicks) ||
      !isUint32(input.freshnessWindowTicks) ||
      !isUint32(input.availableTick) ||
      !isUint32(input.expiresTick) ||
      input.availableTick > input.expiresTick ||
      !isPreconditionMask(input.preconditionMask) ||
      !isEntityId(input.stableOwnerId) ||
      !isEntityId(input.stableSequence)
    ) {
      return { ok: false, reason: "m5_season_event_value_out_of_range" };
    }
    return { ok: true };
  }

  private validateRecoveryWindow(
    input: M5SeasonRecoveryWindowInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5SeasonEventReason } {
    if (!isIndex(input.windowId, this.recoveryWindowCapacity))
      return { ok: false, reason: "m5_season_event_id_out_of_range" };
    if (!isRecoveryType(input.recoveryType))
      return { ok: false, reason: "m5_season_event_value_out_of_range" };
    if (!isUint32(input.startTick) || !isUint32(input.endTick) || input.startTick > input.endTick) {
      return { ok: false, reason: "m5_season_event_value_out_of_range" };
    }
    return isPositiveUint32(input.sourceCandidateVersion)
      ? { ok: true }
      : { ok: false, reason: "m5_season_event_basis_version_invalid" };
  }

  private writeCandidate(input: M5SeasonEventCandidateInput, version: number): void {
    const id = input.candidateId;
    this.candidateActive[id] = 1;
    this.poolIds[id] = input.poolId;
    this.candidateKinds[id] = input.candidateKind;
    this.themes[id] = input.theme;
    this.recoveryTypes[id] = input.recoveryType;
    this.scores[id] = input.score;
    this.priorities[id] = input.priority;
    this.cooldownKeys[id] = input.cooldownKey;
    this.cooldownTicks[id] = input.cooldownTicks;
    this.freshnessWindowTicks[id] = input.freshnessWindowTicks;
    this.commandKinds[id] = input.commandKind;
    this.commandTargets[id] = input.commandTargetId;
    this.sourceEventDefs[id] = input.sourceEventDefId;
    this.anomalyVersions[id] = input.anomalyOwnerVersion;
    this.factionVersions[id] = input.factionOwnerVersion;
    this.governanceVersions[id] = input.governanceOwnerVersion;
    this.seasonVersions[id] = input.seasonOwnerVersion;
    this.resourceVersions[id] = input.resourceOwnerVersion;
    this.recoveryBasisVersions[id] = input.recoveryBasisVersion;
    this.availableTicks[id] = input.availableTick;
    this.expiresTicks[id] = input.expiresTick;
    this.preconditionMasks[id] = input.preconditionMask;
    this.stableOwnerIds[id] = input.stableOwnerId;
    this.stableSequences[id] = input.stableSequence;
    this.candidateVersions[id] = version;
  }

  private linkCandidate(candidateId: number): void {
    const recovery = (this.candidateKinds[candidateId] ?? 0) === M5_SEASON_EVENT_KIND_RECOVERY;
    const recoveryType = this.recoveryTypes[candidateId] ?? M5_SEASON_RECOVERY_NONE;
    let current = recovery ? (this.recoveryHeads[recoveryType] ?? -1) : this.incidentHead;
    let previous = -1;
    while (current >= 0 && this.candidateBefore(current, candidateId)) {
      previous = current;
      current = this.candidateNext[current] ?? -1;
    }
    this.candidatePrevious[candidateId] = previous;
    this.candidateNext[candidateId] = current;
    if (previous >= 0) this.candidateNext[previous] = candidateId;
    else if (recovery) this.recoveryHeads[recoveryType] = candidateId;
    else this.incidentHead = candidateId;
    if (current >= 0) this.candidatePrevious[current] = candidateId;
  }

  private candidateBefore(current: number, next: number): boolean {
    const currentScore = this.scores[current] ?? 0;
    const nextScore = this.scores[next] ?? 0;
    if (currentScore !== nextScore) return currentScore > nextScore;
    const currentPriority = this.priorities[current] ?? 0;
    const nextPriority = this.priorities[next] ?? 0;
    if (currentPriority !== nextPriority) return currentPriority > nextPriority;
    const currentOwner = this.stableOwnerIds[current] ?? M5_SEASON_EVENT_NONE;
    const nextOwner = this.stableOwnerIds[next] ?? M5_SEASON_EVENT_NONE;
    if (currentOwner !== nextOwner) return currentOwner < nextOwner;
    const currentSequence = this.stableSequences[current] ?? M5_SEASON_EVENT_NONE;
    const nextSequence = this.stableSequences[next] ?? M5_SEASON_EVENT_NONE;
    return currentSequence !== nextSequence ? currentSequence < nextSequence : current < next;
  }

  private isTimeEligible(candidateId: number, tick: number): boolean {
    return (
      (this.availableTicks[candidateId] ?? M5_SEASON_EVENT_NONE) <= tick &&
      tick <= (this.expiresTicks[candidateId] ?? 0)
    );
  }

  private isCooldownActive(candidateId: number, tick: number): boolean {
    const key = this.cooldownKeys[candidateId] ?? M5_SEASON_EVENT_NONE;
    return key !== M5_SEASON_EVENT_NONE && (this.cooldownUntilTicks[key] ?? 0) > tick;
  }

  private isFreshnessActive(candidateId: number, tick: number): boolean {
    const theme = this.themes[candidateId] ?? 0;
    const windowTicks = this.freshnessWindowTicks[candidateId] ?? 0;
    const lastTick = this.themeFreshnessTicks[theme] ?? M5_SEASON_EVENT_NONE;
    return lastTick !== M5_SEASON_EVENT_NONE && tick < saturatingAddUint32(lastTick, windowTicks);
  }

  private missingPreconditions(candidateId: number, query: M5SeasonEventSelectionQuery): number {
    return (this.preconditionMasks[candidateId] ?? 0) & ~query.satisfiedPreconditionMask;
  }

  private applyCooldown(candidateId: number, tick: number, version: number): void {
    const key = this.cooldownKeys[candidateId] ?? M5_SEASON_EVENT_NONE;
    const ticks = this.cooldownTicks[candidateId] ?? 0;
    if (key === M5_SEASON_EVENT_NONE || ticks === 0) return;
    this.cooldownUntilTicks[key] = saturatingAddUint32(tick, ticks);
    this.cooldownVersions[key] = version;
    this.cooldownWriteCount += 1;
  }

  private applyFreshness(candidateId: number, tick: number): void {
    const theme = this.themes[candidateId] ?? 0;
    const windowTicks = this.freshnessWindowTicks[candidateId] ?? 0;
    if (windowTicks === 0 || theme <= 0) return;
    this.themeFreshnessTicks[theme] = tick;
    this.eventFreshnessWriteCount += 1;
  }

  private recordPreconditionFailure(
    candidateId: number,
    query: M5SeasonEventSelectionQuery,
    ownerVersion: number,
  ): void {
    const slot = this.failureCursor;
    this.failureSequences[slot] = this.nextFailureSequence;
    this.failureTicks[slot] = query.tick;
    this.failureCandidateIds[slot] = candidateId;
    this.failureMissingMasks[slot] = this.missingPreconditions(candidateId, query);
    this.failureReasonCodes[slot] = encodeReason("m5_season_event_precondition_failed");
    this.failureOwnerVersions[slot] = ownerVersion;
    this.failureCursor = (this.failureCursor + 1) % this.preconditionFailureCapacity;
    this.failureStored = Math.min(this.preconditionFailureCapacity, this.failureStored + 1);
    this.nextFailureSequence += 1;
    this.preconditionFailureCount += 1;
  }

  private getActiveRecoveryWindowId(tick: number): number {
    const windowId = this.activeRecoveryWindowId;
    if (this.isRecoveryWindowActiveAt(windowId, tick)) return windowId;
    for (let fallbackId = 0; fallbackId < this.recoveryWindowCapacity; fallbackId += 1) {
      if (this.isRecoveryWindowActiveAt(fallbackId, tick)) return fallbackId;
    }
    return M5_SEASON_EVENT_NONE;
  }

  private isRecoveryWindowActiveAt(windowId: number, tick: number): boolean {
    if (
      windowId === M5_SEASON_EVENT_NONE ||
      !isIndex(windowId, this.recoveryWindowCapacity) ||
      (this.windowActive[windowId] ?? 0) === 0
    ) {
      return false;
    }
    const start = this.windowStartTicks[windowId] ?? M5_SEASON_EVENT_NONE;
    const end = this.windowEndTicks[windowId] ?? 0;
    return start <= tick && tick <= end;
  }

  private changed(reason: M5SeasonEventReason): M5SeasonEventMutationResult {
    return { ok: true, changed: true, ownerVersion: this.ownerVersionValue, reason };
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "m5_season_event_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "m5_season_event_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }
}

export function createM5SeasonEventPoolStore(
  options: M5SeasonEventPoolStoreOptions,
): M5SeasonEventPoolStore {
  return new M5SeasonEventPoolStore(options);
}

interface SelectionScratch {
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly rejectedCooldownCount: number;
  readonly rejectedPreconditionCount: number;
  readonly rejectedFreshnessCount: number;
  readonly rejectedTimeCount: number;
  readonly candidateCapHit: boolean;
  readonly selectedCapHit: boolean;
}

function validateSelectionQuery(
  query: M5SeasonEventSelectionQuery,
  output: Uint32Array,
): { readonly ok: true } | { readonly ok: false; readonly reason: M5SeasonEventReason } {
  if (query.poolId !== M5_SEASON_EVENT_POOL_FIRST_SEASON)
    return { ok: false, reason: "m5_season_event_pool_id_invalid" };
  if (!isUint32(query.expectedPoolVersion))
    return { ok: false, reason: "m5_season_event_basis_version_invalid" };
  if (!isUint32(query.tick) || !isPreconditionMask(query.satisfiedPreconditionMask))
    return { ok: false, reason: "m5_season_event_value_out_of_range" };
  if (!isPositiveUint16(query.candidateCap))
    return { ok: false, reason: "m5_season_event_candidate_cap_invalid" };
  if (!isPositiveUint16(query.selectedCap))
    return { ok: false, reason: "m5_season_event_selected_cap_invalid" };
  if (output.length < query.selectedCap)
    return { ok: false, reason: "m5_season_event_output_too_small" };
  return query.streamName.length > 0
    ? { ok: true }
    : { ok: false, reason: "m5_season_event_stream_name_invalid" };
}

function isLegalCommand(input: M5SeasonEventCandidateInput): boolean {
  if (input.candidateKind === M5_SEASON_EVENT_KIND_INCIDENT) {
    return (
      input.recoveryType === M5_SEASON_RECOVERY_NONE &&
      input.commandKind === M5_SEASON_COMMAND_SCHEDULE_EVENT
    );
  }
  if (input.candidateKind !== M5_SEASON_EVENT_KIND_RECOVERY) return false;
  if (input.recoveryType === M5_SEASON_RECOVERY_RESOURCE)
    return input.commandKind === M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY;
  if (input.recoveryType === M5_SEASON_RECOVERY_REGISTRATION)
    return input.commandKind === M5_SEASON_COMMAND_REGISTRATION_OPPORTUNITY;
  if (input.recoveryType === M5_SEASON_RECOVERY_MARKET)
    return input.commandKind === M5_SEASON_COMMAND_MARKET_NIGHT_OPPORTUNITY;
  if (input.recoveryType === M5_SEASON_RECOVERY_BRIDGE_ROUTE)
    return input.commandKind === M5_SEASON_COMMAND_BRIDGE_ROUTE_OPPORTUNITY;
  if (input.recoveryType === M5_SEASON_RECOVERY_ARCHIVE)
    return input.commandKind === M5_SEASON_COMMAND_ARCHIVE_REPAIR_OPPORTUNITY;
  return false;
}

function isCandidateKind(value: number): boolean {
  return value === M5_SEASON_EVENT_KIND_INCIDENT || value === M5_SEASON_EVENT_KIND_RECOVERY;
}

function isTheme(value: number): boolean {
  return (
    value === M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE ||
    value === M5_SEASON_EVENT_THEME_REGISTRATION_PRESSURE ||
    value === M5_SEASON_EVENT_THEME_MARKET_NIGHT ||
    value === M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE ||
    value === M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK
  );
}

function isRecoveryTypeForKind(kind: number, recoveryType: number): boolean {
  return kind === M5_SEASON_EVENT_KIND_INCIDENT
    ? recoveryType === M5_SEASON_RECOVERY_NONE
    : isRecoveryType(recoveryType);
}

function isRecoveryType(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= M5_SEASON_RECOVERY_ARCHIVE;
}

function isCooldownKey(value: number, capacity: number): boolean {
  return value === M5_SEASON_EVENT_NONE || isIndex(value, capacity);
}

function isPreconditionMask(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && (value & ~M5_SEASON_PRECONDITION_ALL) === 0;
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isEntityId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < M5_SEASON_EVENT_NONE;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isPositiveUint16(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff;
}

function requirePositive(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function saturatingAddUint32(left: number, right: number): number {
  const value = left + right;
  return value > 0xffff_ffff ? 0xffff_ffff : value;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M5_SEASON_EVENT_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M5_SEASON_EVENT_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}

function encodeReason(reason: M5SeasonEventReason): number {
  if (reason === "m5_season_event_precondition_failed") return 1;
  return 0;
}

function decodeReason(code: number): M5SeasonEventReason {
  return code === 1 ? "m5_season_event_precondition_failed" : "m5_season_event_no_candidate";
}
