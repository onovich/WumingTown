import {
  M4_DIRECTOR_CANDIDATE_INCIDENT,
  M4_DIRECTOR_CANDIDATE_RECOVERY,
  M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_OBLIGATION_SETTLEMENT_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_REST_CARE_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
  M4_DIRECTOR_NONE,
  M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
  M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
  M4_DIRECTOR_RECOVERY_NONE,
  M4_DIRECTOR_RECOVERY_OBLIGATION_SETTLEMENT,
  M4_DIRECTOR_RECOVERY_REST_CARE,
  type M4DirectorCandidateInput,
  type M4DirectorCandidateView,
  type M4DirectorMetrics,
  type M4DirectorMutationResult,
  type M4DirectorPressureSampleInput,
  type M4DirectorPressureSampleView,
  type M4DirectorPressureStoreOptions,
  type M4DirectorReason,
  type M4DirectorRecoveryWindowInput,
  type M4DirectorRecoveryWindowView,
  type M4DirectorSelectionQuery,
  type M4DirectorSelectionResult,
  type M4DirectorTraceView,
} from "./m4-director-types";

const RECOVERY_TYPE_SLOT_COUNT = 5;

export class M4DirectorPressureStore {
  readonly sampleCapacity: number;
  readonly candidateCapacity: number;
  readonly cooldownCapacity: number;
  readonly recoveryWindowCapacity: number;
  readonly traceCapacity: number;

  private readonly sampleTicks: Uint32Array;
  private readonly sampleSequences: Uint32Array;
  private readonly sampleLampVersions: Uint32Array;
  private readonly sampleEvidenceVersions: Uint32Array;
  private readonly sampleObligationVersions: Uint32Array;
  private readonly sampleCrisisVersions: Uint32Array;
  private readonly sampleHealthVersions: Uint32Array;
  private readonly sampleRelationshipVersions: Uint32Array;
  private readonly sampleCaseVersions: Uint32Array;
  private readonly sampleLampPressures: Uint32Array;
  private readonly sampleEvidencePressures: Uint32Array;
  private readonly sampleObligationPressures: Uint32Array;
  private readonly sampleCrisisPressures: Uint32Array;
  private readonly sampleInjuryPressures: Uint32Array;
  private readonly sampleMentalPressures: Uint32Array;
  private readonly sampleCasePressures: Uint32Array;
  private readonly sampleTotalPressures: Uint32Array;
  private sampleCursor = 0;
  private sampleStored = 0;
  private nextSampleSequence = 1;

  private readonly candidateActive: Uint8Array;
  private readonly candidateKinds: Uint8Array;
  private readonly themes: Uint8Array;
  private readonly recoveryTypes: Uint8Array;
  private readonly scores: Uint32Array;
  private readonly priorities: Uint16Array;
  private readonly pressureMins: Uint32Array;
  private readonly cooldownKeys: Uint32Array;
  private readonly cooldownTicks: Uint32Array;
  private readonly commandKinds: Uint16Array;
  private readonly commandTargets: Uint32Array;
  private readonly sourceVersions: Uint32Array;
  private readonly availableTicks: Uint32Array;
  private readonly expiresTicks: Uint32Array;
  private readonly candidateVersions: Uint32Array;
  private readonly candidateNext: Int32Array;
  private readonly candidatePrevious: Int32Array;
  private readonly recoveryHeads: Int32Array;
  private incidentHead = -1;

  private readonly cooldownUntilTicks: Uint32Array;
  private readonly cooldownVersions: Uint32Array;

  private readonly windowActive: Uint8Array;
  private readonly windowRecoveryTypes: Uint8Array;
  private readonly windowStartTicks: Uint32Array;
  private readonly windowEndTicks: Uint32Array;
  private readonly windowSampleVersions: Uint32Array;
  private readonly windowVersions: Uint32Array;
  private activeRecoveryWindowId = M4_DIRECTOR_NONE;

  private readonly traceSequences: Uint32Array;
  private readonly traceTicks: Uint32Array;
  private readonly traceSelectedCandidates: Uint32Array;
  private readonly traceCommandKinds: Uint16Array;
  private readonly traceVisitedCounts: Uint16Array;
  private readonly traceSelectedCounts: Uint16Array;
  private readonly traceCandidateCaps: Uint16Array;
  private readonly traceSelectedCaps: Uint16Array;
  private readonly traceRecoveryActive: Uint8Array;
  private readonly traceReasonCodes: Uint8Array;
  private readonly traceOwnerVersions: Uint32Array;
  private traceCursor = 0;
  private traceStored = 0;
  private nextTraceSequence = 1;

  private ownerVersionValue = 0;
  private activeIncidentCount = 0;
  private activeRecoveryCount = 0;
  private recoveryWindowCount = 0;
  private selectionCount = 0;
  private lastCandidateVisits = 0;
  private totalCandidateVisits = 0;
  private cooldownWriteCount = 0;

  constructor(options: M4DirectorPressureStoreOptions) {
    this.sampleCapacity = requirePositive(options.sampleCapacity, "sample capacity");
    this.candidateCapacity = requirePositive(options.candidateCapacity, "candidate capacity");
    this.cooldownCapacity = requirePositive(options.cooldownCapacity, "cooldown capacity");
    this.recoveryWindowCapacity = requirePositive(
      options.recoveryWindowCapacity,
      "recovery window capacity",
    );
    this.traceCapacity = requirePositive(options.traceCapacity, "trace capacity");
    this.sampleTicks = filledUint32(this.sampleCapacity);
    this.sampleSequences = new Uint32Array(this.sampleCapacity);
    this.sampleLampVersions = new Uint32Array(this.sampleCapacity);
    this.sampleEvidenceVersions = new Uint32Array(this.sampleCapacity);
    this.sampleObligationVersions = new Uint32Array(this.sampleCapacity);
    this.sampleCrisisVersions = new Uint32Array(this.sampleCapacity);
    this.sampleHealthVersions = new Uint32Array(this.sampleCapacity);
    this.sampleRelationshipVersions = new Uint32Array(this.sampleCapacity);
    this.sampleCaseVersions = new Uint32Array(this.sampleCapacity);
    this.sampleLampPressures = new Uint32Array(this.sampleCapacity);
    this.sampleEvidencePressures = new Uint32Array(this.sampleCapacity);
    this.sampleObligationPressures = new Uint32Array(this.sampleCapacity);
    this.sampleCrisisPressures = new Uint32Array(this.sampleCapacity);
    this.sampleInjuryPressures = new Uint32Array(this.sampleCapacity);
    this.sampleMentalPressures = new Uint32Array(this.sampleCapacity);
    this.sampleCasePressures = new Uint32Array(this.sampleCapacity);
    this.sampleTotalPressures = new Uint32Array(this.sampleCapacity);
    this.candidateActive = new Uint8Array(this.candidateCapacity);
    this.candidateKinds = new Uint8Array(this.candidateCapacity);
    this.themes = new Uint8Array(this.candidateCapacity);
    this.recoveryTypes = new Uint8Array(this.candidateCapacity);
    this.scores = new Uint32Array(this.candidateCapacity);
    this.priorities = new Uint16Array(this.candidateCapacity);
    this.pressureMins = new Uint32Array(this.candidateCapacity);
    this.cooldownKeys = filledUint32(this.candidateCapacity);
    this.cooldownTicks = new Uint32Array(this.candidateCapacity);
    this.commandKinds = new Uint16Array(this.candidateCapacity);
    this.commandTargets = filledUint32(this.candidateCapacity);
    this.sourceVersions = new Uint32Array(this.candidateCapacity);
    this.availableTicks = filledUint32(this.candidateCapacity);
    this.expiresTicks = filledUint32(this.candidateCapacity);
    this.candidateVersions = new Uint32Array(this.candidateCapacity);
    this.candidateNext = filledInt32(this.candidateCapacity);
    this.candidatePrevious = filledInt32(this.candidateCapacity);
    this.recoveryHeads = filledInt32(RECOVERY_TYPE_SLOT_COUNT);
    this.cooldownUntilTicks = new Uint32Array(this.cooldownCapacity);
    this.cooldownVersions = new Uint32Array(this.cooldownCapacity);
    this.windowActive = new Uint8Array(this.recoveryWindowCapacity);
    this.windowRecoveryTypes = new Uint8Array(this.recoveryWindowCapacity);
    this.windowStartTicks = filledUint32(this.recoveryWindowCapacity);
    this.windowEndTicks = filledUint32(this.recoveryWindowCapacity);
    this.windowSampleVersions = new Uint32Array(this.recoveryWindowCapacity);
    this.windowVersions = new Uint32Array(this.recoveryWindowCapacity);
    this.traceSequences = new Uint32Array(this.traceCapacity);
    this.traceTicks = filledUint32(this.traceCapacity);
    this.traceSelectedCandidates = filledUint32(this.traceCapacity);
    this.traceCommandKinds = new Uint16Array(this.traceCapacity);
    this.traceVisitedCounts = new Uint16Array(this.traceCapacity);
    this.traceSelectedCounts = new Uint16Array(this.traceCapacity);
    this.traceCandidateCaps = new Uint16Array(this.traceCapacity);
    this.traceSelectedCaps = new Uint16Array(this.traceCapacity);
    this.traceRecoveryActive = new Uint8Array(this.traceCapacity);
    this.traceReasonCodes = new Uint8Array(this.traceCapacity);
    this.traceOwnerVersions = new Uint32Array(this.traceCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  recordPressureSample(input: M4DirectorPressureSampleInput): M4DirectorMutationResult {
    const valid = validatePressureSample(input);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    const slot = this.sampleCursor;
    this.writePressureSample(slot, input, nextVersion.ownerVersion);
    this.sampleCursor = (this.sampleCursor + 1) % this.sampleCapacity;
    this.sampleStored = Math.min(this.sampleCapacity, this.sampleStored + 1);
    this.nextSampleSequence += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed("director_pressure_sampled");
  }

  registerCandidate(input: M4DirectorCandidateInput): M4DirectorMutationResult {
    const valid = this.validateCandidate(input);
    if (!valid.ok) return valid;
    if ((this.candidateActive[input.candidateId] ?? 0) === 1) {
      return { ok: false, reason: "director_candidate_already_registered" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.writeCandidate(input, nextVersion.ownerVersion);
    this.linkCandidate(input.candidateId);
    if (input.candidateKind === M4_DIRECTOR_CANDIDATE_INCIDENT) this.activeIncidentCount += 1;
    else this.activeRecoveryCount += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed("director_candidate_registered");
  }

  openRecoveryWindow(input: M4DirectorRecoveryWindowInput): M4DirectorMutationResult {
    const valid = this.validateRecoveryWindow(input);
    if (!valid.ok) return valid;
    if ((this.windowActive[input.windowId] ?? 0) === 1) {
      return { ok: false, reason: "director_recovery_window_already_open" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.windowActive[input.windowId] = 1;
    this.windowRecoveryTypes[input.windowId] = input.recoveryType;
    this.windowStartTicks[input.windowId] = input.startTick;
    this.windowEndTicks[input.windowId] = input.endTick;
    this.windowSampleVersions[input.windowId] = input.sourceSampleVersion;
    this.windowVersions[input.windowId] = nextVersion.ownerVersion;
    this.activeRecoveryWindowId = input.windowId;
    this.recoveryWindowCount += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return this.changed("director_recovery_window_opened");
  }

  selectOpportunity(
    query: M4DirectorSelectionQuery,
    outputCandidateIds: Uint32Array,
  ): M4DirectorSelectionResult {
    const valid = validateSelectionQuery(query, outputCandidateIds);
    if (!valid.ok) return valid;
    clearOutput(outputCandidateIds, query.selectedCap);
    if (this.sampleStored === 0) return { ok: false, reason: "director_pressure_missing" };
    const recoveryWindowId = this.getActiveRecoveryWindowId(query.tick);
    const recoveryActive = recoveryWindowId !== M4_DIRECTOR_NONE;
    const recoveryType = recoveryActive
      ? (this.windowRecoveryTypes[recoveryWindowId] ?? M4_DIRECTOR_RECOVERY_NONE)
      : M4_DIRECTOR_RECOVERY_NONE;
    const head = recoveryActive ? (this.recoveryHeads[recoveryType] ?? -1) : this.incidentHead;
    const selection = this.collectCandidates(head, query, recoveryActive, outputCandidateIds);
    this.lastCandidateVisits = selection.visitedCount;
    this.totalCandidateVisits += selection.visitedCount;
    const selected = this.chooseCandidate(selection.selectedCount, query, outputCandidateIds);
    const reason = selectionReason(selected.selectedCandidateId, selection, recoveryActive);
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return { ok: false, reason: nextVersion.reason };
    if (selected.selectedCandidateId !== M4_DIRECTOR_NONE) {
      this.applyCooldown(selected.selectedCandidateId, query.tick, nextVersion.ownerVersion);
    }
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.selectionCount += 1;
    this.recordTrace(query, selection, selected.selectedCandidateId, recoveryActive, reason);
    return {
      ok: true,
      selectedCount: selection.selectedCount,
      visitedCount: selection.visitedCount,
      rejectedCooldownCount: selection.rejectedCooldownCount,
      rejectedPressureCount: selection.rejectedPressureCount,
      rejectedTimeCount: selection.rejectedTimeCount,
      candidateCapHit: selection.candidateCapHit,
      selectedCapHit: selection.selectedCapHit,
      recoveryWindowActive: recoveryActive,
      selectedCandidateId: selected.selectedCandidateId,
      selectedCommandKind:
        selected.selectedCandidateId === M4_DIRECTOR_NONE
          ? 0
          : (this.commandKinds[selected.selectedCandidateId] ?? 0),
      selectedCommandTargetId:
        selected.selectedCandidateId === M4_DIRECTOR_NONE
          ? M4_DIRECTOR_NONE
          : (this.commandTargets[selected.selectedCandidateId] ?? M4_DIRECTOR_NONE),
      selectedRecoveryType:
        selected.selectedCandidateId === M4_DIRECTOR_NONE
          ? M4_DIRECTOR_RECOVERY_NONE
          : (this.recoveryTypes[selected.selectedCandidateId] ?? M4_DIRECTOR_RECOVERY_NONE),
      randomChoiceIndex: selected.randomChoiceIndex,
      randomDraw: selected.randomDraw,
      ownerVersion: this.ownerVersionValue,
      reason,
    };
  }

  readLatestPressureSample(): M4DirectorPressureSampleView | undefined {
    if (this.sampleStored === 0) return undefined;
    const slot = (this.sampleCursor + this.sampleCapacity - 1) % this.sampleCapacity;
    return this.readPressureSampleSlot(slot);
  }

  readCandidate(candidateId: number): M4DirectorCandidateView | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    ) {
      return undefined;
    }
    return {
      candidateId,
      candidateKind: this.candidateKinds[candidateId] ?? 0,
      theme: this.themes[candidateId] ?? 0,
      recoveryType: this.recoveryTypes[candidateId] ?? 0,
      score: this.scores[candidateId] ?? 0,
      priority: this.priorities[candidateId] ?? 0,
      pressureMin: this.pressureMins[candidateId] ?? 0,
      cooldownKey: this.cooldownKeys[candidateId] ?? M4_DIRECTOR_NONE,
      cooldownTicks: this.cooldownTicks[candidateId] ?? 0,
      commandKind: this.commandKinds[candidateId] ?? 0,
      commandTargetId: this.commandTargets[candidateId] ?? M4_DIRECTOR_NONE,
      sourceOwnerVersion: this.sourceVersions[candidateId] ?? 0,
      availableTick: this.availableTicks[candidateId] ?? M4_DIRECTOR_NONE,
      expiresTick: this.expiresTicks[candidateId] ?? M4_DIRECTOR_NONE,
      candidateVersion: this.candidateVersions[candidateId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readRecoveryWindow(windowId: number): M4DirectorRecoveryWindowView | undefined {
    if (
      !isIndex(windowId, this.recoveryWindowCapacity) ||
      (this.windowActive[windowId] ?? 0) === 0
    ) {
      return undefined;
    }
    return {
      windowId,
      recoveryType: this.windowRecoveryTypes[windowId] ?? 0,
      startTick: this.windowStartTicks[windowId] ?? M4_DIRECTOR_NONE,
      endTick: this.windowEndTicks[windowId] ?? M4_DIRECTOR_NONE,
      sourceSampleVersion: this.windowSampleVersions[windowId] ?? 0,
      active: 0,
      windowVersion: this.windowVersions[windowId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  isRecoveryWindowActive(windowId: number, tick: number): boolean {
    return (
      isIndex(windowId, this.recoveryWindowCapacity) &&
      this.getActiveRecoveryWindowId(tick) === windowId
    );
  }

  readTrace(ageFromNewest: number): M4DirectorTraceView | undefined {
    if (!isIndex(ageFromNewest, this.traceStored)) return undefined;
    const slot = (this.traceCursor + this.traceCapacity - 1 - ageFromNewest) % this.traceCapacity;
    return {
      sequence: this.traceSequences[slot] ?? 0,
      tick: this.traceTicks[slot] ?? M4_DIRECTOR_NONE,
      selectedCandidateId: this.traceSelectedCandidates[slot] ?? M4_DIRECTOR_NONE,
      selectedCommandKind: this.traceCommandKinds[slot] ?? 0,
      visitedCount: this.traceVisitedCounts[slot] ?? 0,
      selectedCount: this.traceSelectedCounts[slot] ?? 0,
      candidateCap: this.traceCandidateCaps[slot] ?? 0,
      selectedCap: this.traceSelectedCaps[slot] ?? 0,
      recoveryWindowActive: this.traceRecoveryActive[slot] ?? 0,
      reason: decodeReason(this.traceReasonCodes[slot] ?? 0),
      ownerVersion: this.traceOwnerVersions[slot] ?? 0,
    };
  }

  createMetrics(): M4DirectorMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      pressureSampleCount: this.sampleStored,
      activeIncidentCandidateCount: this.activeIncidentCount,
      activeRecoveryCandidateCount: this.activeRecoveryCount,
      recoveryWindowCount: this.recoveryWindowCount,
      activeRecoveryWindowId: this.activeRecoveryWindowId,
      selectionCount: this.selectionCount,
      lastCandidateVisits: this.lastCandidateVisits,
      totalCandidateVisits: this.totalCandidateVisits,
      cooldownWriteCount: this.cooldownWriteCount,
      traceStoredCount: this.traceStored,
      nextTraceSequence: this.nextTraceSequence,
    };
  }

  private writePressureSample(
    slot: number,
    input: M4DirectorPressureSampleInput,
    version: number,
  ): void {
    this.sampleTicks[slot] = input.tick;
    this.sampleSequences[slot] = this.nextSampleSequence;
    this.sampleLampVersions[slot] = input.lampOwnerVersion;
    this.sampleEvidenceVersions[slot] = input.evidenceOwnerVersion;
    this.sampleObligationVersions[slot] = input.obligationOwnerVersion;
    this.sampleCrisisVersions[slot] = input.crisisOwnerVersion;
    this.sampleHealthVersions[slot] = input.healthOwnerVersion;
    this.sampleRelationshipVersions[slot] = input.relationshipOwnerVersion;
    this.sampleCaseVersions[slot] = input.caseOwnerVersion;
    this.sampleLampPressures[slot] = input.lampPressure;
    this.sampleEvidencePressures[slot] = input.evidencePressure;
    this.sampleObligationPressures[slot] = input.obligationPressure;
    this.sampleCrisisPressures[slot] = input.crisisPressure;
    this.sampleInjuryPressures[slot] = input.injuryPressure;
    this.sampleMentalPressures[slot] = input.mentalRiskPressure;
    this.sampleCasePressures[slot] = input.unresolvedCasePressure;
    this.sampleTotalPressures[slot] = calculateTotalPressure(input);
    this.ownerVersionValue = version;
  }

  private readPressureSampleSlot(slot: number): M4DirectorPressureSampleView {
    return {
      tick: this.sampleTicks[slot] ?? M4_DIRECTOR_NONE,
      lampOwnerVersion: this.sampleLampVersions[slot] ?? 0,
      evidenceOwnerVersion: this.sampleEvidenceVersions[slot] ?? 0,
      obligationOwnerVersion: this.sampleObligationVersions[slot] ?? 0,
      crisisOwnerVersion: this.sampleCrisisVersions[slot] ?? 0,
      healthOwnerVersion: this.sampleHealthVersions[slot] ?? 0,
      relationshipOwnerVersion: this.sampleRelationshipVersions[slot] ?? 0,
      caseOwnerVersion: this.sampleCaseVersions[slot] ?? 0,
      lampPressure: this.sampleLampPressures[slot] ?? 0,
      evidencePressure: this.sampleEvidencePressures[slot] ?? 0,
      obligationPressure: this.sampleObligationPressures[slot] ?? 0,
      crisisPressure: this.sampleCrisisPressures[slot] ?? 0,
      injuryPressure: this.sampleInjuryPressures[slot] ?? 0,
      mentalRiskPressure: this.sampleMentalPressures[slot] ?? 0,
      unresolvedCasePressure: this.sampleCasePressures[slot] ?? 0,
      sampleSequence: this.sampleSequences[slot] ?? 0,
      totalPressure: this.sampleTotalPressures[slot] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  private validateCandidate(
    input: M4DirectorCandidateInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4DirectorReason } {
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "director_id_out_of_range" };
    if (!isCandidateKind(input.candidateKind) || !isTheme(input.theme) || !isScore(input.score)) {
      return { ok: false, reason: "director_value_out_of_range" };
    }
    if (!isUint16(input.priority) || !isTotalPressure(input.pressureMin))
      return { ok: false, reason: "director_value_out_of_range" };
    if (
      !isCooldownKey(input.cooldownKey, this.cooldownCapacity) ||
      !isUint32(input.cooldownTicks)
    ) {
      return { ok: false, reason: "director_value_out_of_range" };
    }
    if (!isUint32(input.commandTargetId) || !isPositiveUint32(input.sourceOwnerVersion)) {
      return { ok: false, reason: "director_basis_version_invalid" };
    }
    if (
      !isUint32(input.availableTick) ||
      !isUint32(input.expiresTick) ||
      input.availableTick > input.expiresTick
    ) {
      return { ok: false, reason: "director_value_out_of_range" };
    }
    return isLegalCommand(input)
      ? { ok: true }
      : { ok: false, reason: "director_value_out_of_range" };
  }

  private validateRecoveryWindow(
    input: M4DirectorRecoveryWindowInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4DirectorReason } {
    if (!isIndex(input.windowId, this.recoveryWindowCapacity))
      return { ok: false, reason: "director_id_out_of_range" };
    if (!isRecoveryType(input.recoveryType))
      return { ok: false, reason: "director_value_out_of_range" };
    if (!isUint32(input.startTick) || !isUint32(input.endTick) || input.startTick > input.endTick) {
      return { ok: false, reason: "director_value_out_of_range" };
    }
    return isPositiveUint32(input.sourceSampleVersion)
      ? { ok: true }
      : { ok: false, reason: "director_basis_version_invalid" };
  }

  private writeCandidate(input: M4DirectorCandidateInput, version: number): void {
    this.candidateActive[input.candidateId] = 1;
    this.candidateKinds[input.candidateId] = input.candidateKind;
    this.themes[input.candidateId] = input.theme;
    this.recoveryTypes[input.candidateId] = input.recoveryType;
    this.scores[input.candidateId] = input.score;
    this.priorities[input.candidateId] = input.priority;
    this.pressureMins[input.candidateId] = input.pressureMin;
    this.cooldownKeys[input.candidateId] = input.cooldownKey;
    this.cooldownTicks[input.candidateId] = input.cooldownTicks;
    this.commandKinds[input.candidateId] = input.commandKind;
    this.commandTargets[input.candidateId] = input.commandTargetId;
    this.sourceVersions[input.candidateId] = input.sourceOwnerVersion;
    this.availableTicks[input.candidateId] = input.availableTick;
    this.expiresTicks[input.candidateId] = input.expiresTick;
    this.candidateVersions[input.candidateId] = version;
  }

  private linkCandidate(candidateId: number): void {
    const recovery = (this.candidateKinds[candidateId] ?? 0) === M4_DIRECTOR_CANDIDATE_RECOVERY;
    const recoveryType = this.recoveryTypes[candidateId] ?? M4_DIRECTOR_RECOVERY_NONE;
    let current = recovery ? (this.recoveryHeads[recoveryType] ?? -1) : this.incidentHead;
    let previous = -1;
    while (current >= 0 && candidateBefore(current, candidateId, this.scores, this.priorities)) {
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

  private collectCandidates(
    head: number,
    query: M4DirectorSelectionQuery,
    recoveryActive: boolean,
    output: Uint32Array,
  ): SelectionScratch {
    let current = head;
    let visitedCount = 0;
    let selectedCount = 0;
    let rejectedCooldownCount = 0;
    let rejectedPressureCount = 0;
    let rejectedTimeCount = 0;
    let candidateCapHit = false;
    let selectedCapHit = false;
    const totalPressure = this.readLatestTotalPressure();
    while (current >= 0) {
      if (visitedCount >= query.candidateCap) {
        candidateCapHit = true;
        break;
      }
      visitedCount += 1;
      if (!this.isTimeEligible(current, query.tick)) {
        rejectedTimeCount += 1;
      } else if (!recoveryActive && totalPressure < (this.pressureMins[current] ?? 0)) {
        rejectedPressureCount += 1;
      } else if (this.isCooldownActive(current, query.tick)) {
        rejectedCooldownCount += 1;
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
      rejectedPressureCount,
      rejectedTimeCount,
      candidateCapHit,
      selectedCapHit,
    };
  }

  private chooseCandidate(
    selectedCount: number,
    query: M4DirectorSelectionQuery,
    output: Uint32Array,
  ): {
    readonly selectedCandidateId: number;
    readonly randomChoiceIndex: number;
    readonly randomDraw: number;
  } {
    if (selectedCount === 0) {
      return {
        selectedCandidateId: M4_DIRECTOR_NONE,
        randomChoiceIndex: M4_DIRECTOR_NONE,
        randomDraw: 0,
      };
    }
    const draw = query.randomStreams.nextUint32(query.streamName);
    const choiceIndex = draw % selectedCount;
    return {
      selectedCandidateId: output[choiceIndex] ?? M4_DIRECTOR_NONE,
      randomChoiceIndex: choiceIndex,
      randomDraw: draw,
    };
  }

  private applyCooldown(candidateId: number, tick: number, version: number): void {
    const key = this.cooldownKeys[candidateId] ?? M4_DIRECTOR_NONE;
    const ticks = this.cooldownTicks[candidateId] ?? 0;
    if (key === M4_DIRECTOR_NONE || ticks === 0) return;
    this.cooldownUntilTicks[key] = saturatingAddUint32(tick, ticks);
    this.cooldownVersions[key] = version;
    this.cooldownWriteCount += 1;
  }

  private recordTrace(
    query: M4DirectorSelectionQuery,
    selection: SelectionScratch,
    selectedCandidateId: number,
    recoveryActive: boolean,
    reason: M4DirectorReason,
  ): void {
    const slot = this.traceCursor;
    this.traceSequences[slot] = this.nextTraceSequence;
    this.traceTicks[slot] = query.tick;
    this.traceSelectedCandidates[slot] = selectedCandidateId;
    this.traceCommandKinds[slot] =
      selectedCandidateId === M4_DIRECTOR_NONE ? 0 : (this.commandKinds[selectedCandidateId] ?? 0);
    this.traceVisitedCounts[slot] = selection.visitedCount;
    this.traceSelectedCounts[slot] = selection.selectedCount;
    this.traceCandidateCaps[slot] = query.candidateCap;
    this.traceSelectedCaps[slot] = query.selectedCap;
    this.traceRecoveryActive[slot] = recoveryActive ? 1 : 0;
    this.traceReasonCodes[slot] = encodeReason(reason);
    this.traceOwnerVersions[slot] = this.ownerVersionValue;
    this.traceCursor = (this.traceCursor + 1) % this.traceCapacity;
    this.traceStored = Math.min(this.traceCapacity, this.traceStored + 1);
    this.nextTraceSequence += 1;
  }

  private isTimeEligible(candidateId: number, tick: number): boolean {
    return (
      (this.availableTicks[candidateId] ?? M4_DIRECTOR_NONE) <= tick &&
      tick <= (this.expiresTicks[candidateId] ?? 0)
    );
  }

  private isCooldownActive(candidateId: number, tick: number): boolean {
    const key = this.cooldownKeys[candidateId] ?? M4_DIRECTOR_NONE;
    return key !== M4_DIRECTOR_NONE && (this.cooldownUntilTicks[key] ?? 0) > tick;
  }

  private readLatestTotalPressure(): number {
    if (this.sampleStored === 0) return 0;
    const slot = (this.sampleCursor + this.sampleCapacity - 1) % this.sampleCapacity;
    return this.sampleTotalPressures[slot] ?? 0;
  }

  private getActiveRecoveryWindowId(tick: number): number {
    const windowId = this.activeRecoveryWindowId;
    if (windowId === M4_DIRECTOR_NONE || (this.windowActive[windowId] ?? 0) === 0)
      return M4_DIRECTOR_NONE;
    const start = this.windowStartTicks[windowId] ?? M4_DIRECTOR_NONE;
    const end = this.windowEndTicks[windowId] ?? 0;
    return start <= tick && tick <= end ? windowId : M4_DIRECTOR_NONE;
  }

  private changed(reason: M4DirectorReason): M4DirectorMutationResult {
    return { ok: true, changed: true, ownerVersion: this.ownerVersionValue, reason };
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "director_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "director_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }
}

export function createM4DirectorPressureStore(
  options: M4DirectorPressureStoreOptions,
): M4DirectorPressureStore {
  return new M4DirectorPressureStore(options);
}

interface SelectionScratch {
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly rejectedCooldownCount: number;
  readonly rejectedPressureCount: number;
  readonly rejectedTimeCount: number;
  readonly candidateCapHit: boolean;
  readonly selectedCapHit: boolean;
}

function validatePressureSample(
  input: M4DirectorPressureSampleInput,
): { readonly ok: true } | { readonly ok: false; readonly reason: M4DirectorReason } {
  if (!isUint32(input.tick)) return { ok: false, reason: "director_value_out_of_range" };
  if (
    !isPositiveUint32(input.lampOwnerVersion) ||
    !isPositiveUint32(input.evidenceOwnerVersion) ||
    !isPositiveUint32(input.obligationOwnerVersion) ||
    !isPositiveUint32(input.crisisOwnerVersion) ||
    !isPositiveUint32(input.healthOwnerVersion) ||
    !isPositiveUint32(input.relationshipOwnerVersion) ||
    !isPositiveUint32(input.caseOwnerVersion)
  ) {
    return { ok: false, reason: "director_basis_version_invalid" };
  }
  return isScore(input.lampPressure) &&
    isScore(input.evidencePressure) &&
    isScore(input.obligationPressure) &&
    isScore(input.crisisPressure) &&
    isScore(input.injuryPressure) &&
    isScore(input.mentalRiskPressure) &&
    isScore(input.unresolvedCasePressure)
    ? { ok: true }
    : { ok: false, reason: "director_value_out_of_range" };
}

function validateSelectionQuery(
  query: M4DirectorSelectionQuery,
  output: Uint32Array,
): { readonly ok: true } | { readonly ok: false; readonly reason: M4DirectorReason } {
  if (!isUint32(query.tick)) return { ok: false, reason: "director_value_out_of_range" };
  if (!isPositiveUint16(query.candidateCap))
    return { ok: false, reason: "director_candidate_cap_invalid" };
  if (!isPositiveUint16(query.selectedCap))
    return { ok: false, reason: "director_selected_cap_invalid" };
  if (output.length < query.selectedCap) return { ok: false, reason: "director_output_too_small" };
  return query.streamName.length > 0
    ? { ok: true }
    : { ok: false, reason: "director_stream_name_invalid" };
}

function calculateTotalPressure(input: M4DirectorPressureSampleInput): number {
  return (
    input.lampPressure +
    input.evidencePressure +
    input.obligationPressure +
    input.crisisPressure +
    input.injuryPressure +
    input.mentalRiskPressure +
    input.unresolvedCasePressure
  );
}

function selectionReason(
  selectedCandidateId: number,
  selection: SelectionScratch,
  recoveryActive: boolean,
): M4DirectorReason {
  if (selectedCandidateId !== M4_DIRECTOR_NONE) {
    return recoveryActive ? "director_recovery_selected" : "director_incident_selected";
  }
  if (recoveryActive) return "director_recovery_window_active";
  if (selection.rejectedCooldownCount > 0) return "director_cooldown_active";
  if (selection.rejectedPressureCount > 0) return "director_pressure_rejected";
  if (selection.rejectedTimeCount > 0) return "director_time_rejected";
  if (selection.candidateCapHit) return "director_candidate_cap_reached";
  if (selection.selectedCapHit) return "director_selected_cap_reached";
  return "director_no_candidate";
}

function candidateBefore(
  current: number,
  next: number,
  scores: Uint32Array,
  priorities: Uint16Array,
): boolean {
  const currentScore = scores[current] ?? 0;
  const nextScore = scores[next] ?? 0;
  if (currentScore !== nextScore) return currentScore > nextScore;
  const currentPriority = priorities[current] ?? 0;
  const nextPriority = priorities[next] ?? 0;
  if (currentPriority !== nextPriority) return currentPriority > nextPriority;
  return current < next;
}

function isLegalCommand(input: M4DirectorCandidateInput): boolean {
  if (input.candidateKind === M4_DIRECTOR_CANDIDATE_INCIDENT) {
    return (
      input.recoveryType === M4_DIRECTOR_RECOVERY_NONE &&
      input.commandKind === M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT
    );
  }
  if (input.candidateKind !== M4_DIRECTOR_CANDIDATE_RECOVERY) return false;
  if (input.recoveryType === M4_DIRECTOR_RECOVERY_LAMP_REPAIR)
    return input.commandKind === M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY;
  if (input.recoveryType === M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW)
    return input.commandKind === M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY;
  if (input.recoveryType === M4_DIRECTOR_RECOVERY_OBLIGATION_SETTLEMENT)
    return input.commandKind === M4_DIRECTOR_COMMAND_OBLIGATION_SETTLEMENT_OPPORTUNITY;
  if (input.recoveryType === M4_DIRECTOR_RECOVERY_REST_CARE)
    return input.commandKind === M4_DIRECTOR_COMMAND_REST_CARE_OPPORTUNITY;
  return false;
}

function isCandidateKind(value: number): boolean {
  return value === M4_DIRECTOR_CANDIDATE_INCIDENT || value === M4_DIRECTOR_CANDIDATE_RECOVERY;
}

function isTheme(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 7;
}

function isRecoveryType(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 4;
}

function isCooldownKey(value: number, capacity: number): boolean {
  return value === M4_DIRECTOR_NONE || isIndex(value, capacity);
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isTotalPressure(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 7_000;
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

function isUint16(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
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
  for (let index = 0; index < count; index += 1) output[index] = M4_DIRECTOR_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M4_DIRECTOR_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}

function encodeReason(reason: M4DirectorReason): number {
  if (reason === "director_incident_selected") return 1;
  if (reason === "director_recovery_selected") return 2;
  if (reason === "director_recovery_window_active") return 3;
  if (reason === "director_cooldown_active") return 4;
  if (reason === "director_candidate_cap_reached") return 5;
  if (reason === "director_pressure_rejected") return 6;
  if (reason === "director_time_rejected") return 7;
  return 0;
}

function decodeReason(code: number): M4DirectorReason {
  if (code === 1) return "director_incident_selected";
  if (code === 2) return "director_recovery_selected";
  if (code === 3) return "director_recovery_window_active";
  if (code === 4) return "director_cooldown_active";
  if (code === 5) return "director_candidate_cap_reached";
  if (code === 6) return "director_pressure_rejected";
  if (code === 7) return "director_time_rejected";
  return "director_no_candidate";
}
