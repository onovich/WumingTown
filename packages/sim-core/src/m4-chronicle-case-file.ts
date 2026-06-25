import {
  M4_CHRONICLE_CASE_STATUS_CLOSED,
  M4_CHRONICLE_CASE_STATUS_OPEN,
  M4_CHRONICLE_CHANGE_CASE_OPENED,
  M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED,
  M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED,
  M4_CHRONICLE_CHANGE_DISSEMINATED,
  M4_CHRONICLE_CHANGE_EVIDENCE_ADDED,
  M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED,
  M4_CHRONICLE_CHANGE_RULE_CONFIRMED,
  M4_CHRONICLE_CHANGE_SOURCE_ADDED,
  M4_CHRONICLE_NONE,
  isIndexInRange,
  isUint32,
  requirePositiveSafeInteger,
  type M4ChronicleChangeKind,
  type M4ChronicleReason,
  type M4ChronicleVersionRecorder,
} from "./m4-chronicle-types";

export const M4_CHRONICLE_CASE_FILE_SNAPSHOT_VERSION = 1;

export interface M4ChronicleCaseFileStoreOptions {
  readonly caseCapacity: number;
  readonly versionCapacity: number;
}

export interface M4ChronicleCaseInput {
  readonly caseId: number;
  readonly openedTick: number;
  readonly ownerActorId: number;
  readonly primarySubjectId: number;
}

export interface M4ChronicleCaseView extends M4ChronicleCaseInput {
  readonly status: number;
  readonly caseVersion: number;
  readonly ownerVersion: number;
}

export interface M4ChronicleVersionView {
  readonly sequence: number;
  readonly caseId: number;
  readonly changeKind: M4ChronicleChangeKind;
  readonly subjectId: number;
  readonly tick: number;
  readonly ownerVersion: number;
  readonly caseVersion: number;
}

export type M4ChronicleMutationResult =
  | { readonly ok: true; readonly changed: boolean; readonly ownerVersion: number }
  | { readonly ok: false; readonly reason: M4ChronicleReason };

export interface M4ChronicleCaseFileMetrics {
  readonly ownerVersion: number;
  readonly activeCaseCount: number;
  readonly versionCount: number;
  readonly versionCapacity: number;
}

export class M4ChronicleCaseFileStore implements M4ChronicleVersionRecorder {
  readonly caseCapacity: number;
  readonly versionCapacity: number;

  private readonly active: Uint8Array;
  private readonly statuses: Uint8Array;
  private readonly openedTicks: Uint32Array;
  private readonly ownerActorIds: Uint32Array;
  private readonly primarySubjectIds: Uint32Array;
  private readonly caseVersions: Uint32Array;
  private readonly historySequences: Uint32Array;
  private readonly historyCaseIds: Uint32Array;
  private readonly historyKinds: Uint8Array;
  private readonly historySubjectIds: Uint32Array;
  private readonly historyTicks: Uint32Array;
  private readonly historyOwnerVersions: Uint32Array;
  private readonly historyCaseVersions: Uint32Array;
  private activeCaseCountValue = 0;
  private versionCountValue = 0;
  private nextHistorySequence = 1;
  private ownerVersionValue = 0;

  constructor(options: M4ChronicleCaseFileStoreOptions) {
    this.caseCapacity = requirePositiveSafeInteger(options.caseCapacity, "chronicle case capacity");
    this.versionCapacity = requirePositiveSafeInteger(
      options.versionCapacity,
      "chronicle version capacity",
    );
    this.active = new Uint8Array(this.caseCapacity);
    this.statuses = new Uint8Array(this.caseCapacity);
    this.openedTicks = new Uint32Array(this.caseCapacity);
    this.ownerActorIds = new Uint32Array(this.caseCapacity);
    this.primarySubjectIds = new Uint32Array(this.caseCapacity);
    this.caseVersions = new Uint32Array(this.caseCapacity);
    this.historySequences = new Uint32Array(this.versionCapacity);
    this.historyCaseIds = new Uint32Array(this.versionCapacity);
    this.historyKinds = new Uint8Array(this.versionCapacity);
    this.historySubjectIds = new Uint32Array(this.versionCapacity);
    this.historyTicks = new Uint32Array(this.versionCapacity);
    this.historyOwnerVersions = new Uint32Array(this.versionCapacity);
    this.historyCaseVersions = new Uint32Array(this.versionCapacity);
    this.historyCaseIds.fill(M4_CHRONICLE_NONE);
    this.historySubjectIds.fill(M4_CHRONICLE_NONE);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  isCaseActive(caseId: number): boolean {
    return isIndexInRange(caseId, this.caseCapacity) && (this.active[caseId] ?? 0) === 1;
  }

  openCase(input: M4ChronicleCaseInput): M4ChronicleMutationResult {
    if (!this.validateCaseInput(input)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }

    if ((this.active[input.caseId] ?? 0) === 1) {
      return { ok: false, reason: "chronicle_case_already_registered" };
    }

    const canAppend = this.canAppendVersion(input.primarySubjectId, input.openedTick);
    if (!canAppend.ok) {
      return canAppend;
    }

    this.active[input.caseId] = 1;
    this.statuses[input.caseId] = M4_CHRONICLE_CASE_STATUS_OPEN;
    this.openedTicks[input.caseId] = input.openedTick;
    this.ownerActorIds[input.caseId] = input.ownerActorId;
    this.primarySubjectIds[input.caseId] = input.primarySubjectId;
    this.activeCaseCountValue += 1;
    const recorded = this.appendVersion(
      input.caseId,
      M4_CHRONICLE_CHANGE_CASE_OPENED,
      input.primarySubjectId,
      input.openedTick,
    );
    return { ok: true, changed: true, ownerVersion: recorded.ownerVersion };
  }

  closeCase(caseId: number, tick: number): M4ChronicleMutationResult {
    if (!this.isCaseActive(caseId)) {
      return { ok: false, reason: "chronicle_case_not_registered" };
    }

    if ((this.statuses[caseId] ?? 0) === M4_CHRONICLE_CASE_STATUS_CLOSED) {
      return { ok: true, changed: false, ownerVersion: this.ownerVersionValue };
    }

    if (!isUint32(tick)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }

    const canAppend = this.canAppendVersion(caseId, tick);
    if (!canAppend.ok) {
      return canAppend;
    }

    this.statuses[caseId] = M4_CHRONICLE_CASE_STATUS_CLOSED;
    const recorded = this.appendVersion(caseId, M4_CHRONICLE_CHANGE_CASE_OPENED, caseId, tick);
    return { ok: true, changed: true, ownerVersion: recorded.ownerVersion };
  }

  recordVersion(
    caseId: number,
    changeKind: M4ChronicleChangeKind,
    subjectId: number,
    tick: number,
  ):
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (!this.isCaseActive(caseId)) {
      return { ok: false, reason: "chronicle_case_not_registered" };
    }

    const canAppend = this.canAppendVersion(subjectId, tick);
    if (!canAppend.ok) {
      return canAppend;
    }

    return this.appendVersion(caseId, changeKind, subjectId, tick);
  }

  private canAppendVersion(
    subjectId: number,
    tick: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (!isUint32(subjectId) || !isUint32(tick)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }

    if (this.versionCountValue >= this.versionCapacity) {
      return { ok: false, reason: "chronicle_version_capacity_full" };
    }

    if (this.ownerVersionValue >= 0xffff_ffff) {
      return { ok: false, reason: "chronicle_version_exhausted" };
    }

    return { ok: true };
  }

  private appendVersion(
    caseId: number,
    changeKind: M4ChronicleChangeKind,
    subjectId: number,
    tick: number,
  ): { readonly ok: true; readonly ownerVersion: number } {
    this.ownerVersionValue += 1;
    const caseVersion = (this.caseVersions[caseId] ?? 0) + 1;
    this.caseVersions[caseId] = caseVersion;
    const slot = this.versionCountValue;
    this.historySequences[slot] = this.nextHistorySequence;
    this.historyCaseIds[slot] = caseId;
    this.historyKinds[slot] = changeKind;
    this.historySubjectIds[slot] = subjectId;
    this.historyTicks[slot] = tick;
    this.historyOwnerVersions[slot] = this.ownerVersionValue;
    this.historyCaseVersions[slot] = caseVersion;
    this.versionCountValue += 1;
    this.nextHistorySequence += 1;
    return { ok: true, ownerVersion: this.ownerVersionValue };
  }

  readCase(caseId: number): M4ChronicleCaseView | undefined {
    if (!this.isCaseActive(caseId)) {
      return undefined;
    }

    return {
      caseId,
      openedTick: this.openedTicks[caseId] ?? 0,
      ownerActorId: this.ownerActorIds[caseId] ?? 0,
      primarySubjectId: this.primarySubjectIds[caseId] ?? M4_CHRONICLE_NONE,
      status: this.statuses[caseId] ?? 0,
      caseVersion: this.caseVersions[caseId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readVersion(index: number): M4ChronicleVersionView | undefined {
    if (!isIndexInRange(index, this.versionCountValue)) {
      return undefined;
    }

    return {
      sequence: this.historySequences[index] ?? 0,
      caseId: this.historyCaseIds[index] ?? M4_CHRONICLE_NONE,
      changeKind: decodeChronicleChangeKind(this.historyKinds[index] ?? 0),
      subjectId: this.historySubjectIds[index] ?? M4_CHRONICLE_NONE,
      tick: this.historyTicks[index] ?? 0,
      ownerVersion: this.historyOwnerVersions[index] ?? 0,
      caseVersion: this.historyCaseVersions[index] ?? 0,
    };
  }

  createMetrics(): M4ChronicleCaseFileMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeCaseCount: this.activeCaseCountValue,
      versionCount: this.versionCountValue,
      versionCapacity: this.versionCapacity,
    };
  }

  private validateCaseInput(input: M4ChronicleCaseInput): boolean {
    return (
      isIndexInRange(input.caseId, this.caseCapacity) &&
      isUint32(input.openedTick) &&
      isUint32(input.ownerActorId) &&
      isUint32(input.primarySubjectId)
    );
  }
}

export function createM4ChronicleCaseFileStore(
  options: M4ChronicleCaseFileStoreOptions,
): M4ChronicleCaseFileStore {
  return new M4ChronicleCaseFileStore(options);
}

function decodeChronicleChangeKind(value: number): M4ChronicleChangeKind {
  if (value === M4_CHRONICLE_CHANGE_SOURCE_ADDED) return M4_CHRONICLE_CHANGE_SOURCE_ADDED;
  if (value === M4_CHRONICLE_CHANGE_EVIDENCE_ADDED) return M4_CHRONICLE_CHANGE_EVIDENCE_ADDED;
  if (value === M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED) {
    return M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED;
  }
  if (value === M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED) {
    return M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED;
  }
  if (value === M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED) {
    return M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED;
  }
  if (value === M4_CHRONICLE_CHANGE_RULE_CONFIRMED) return M4_CHRONICLE_CHANGE_RULE_CONFIRMED;
  if (value === M4_CHRONICLE_CHANGE_DISSEMINATED) return M4_CHRONICLE_CHANGE_DISSEMINATED;
  return M4_CHRONICLE_CHANGE_CASE_OPENED;
}
