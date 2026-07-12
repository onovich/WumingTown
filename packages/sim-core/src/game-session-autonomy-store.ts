import { assertValidCapacity } from "./entity-id";
import {
  AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED,
  AUTONOMY_REASON_BLOCKED_TARGET_BUSY,
  AUTONOMY_REASON_CAPABILITY_ALLOWED,
  AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
  AUTONOMY_REASON_FAILED_INVARIANT,
  AUTONOMY_REASON_FAILED_TARGET_DESTROYED,
  AUTONOMY_REASON_IDLE_DECISION_DEFERRED,
  AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER,
  AUTONOMY_REASON_IDLE_OFF_SHIFT,
  AUTONOMY_REASON_IDLE_RETRY_BACKOFF,
  AUTONOMY_REASON_INTERRUPTED_DANGER,
  AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY,
  AUTONOMY_REASON_INTERRUPTED_SHIFT_END,
  AUTONOMY_REASON_NEED_HEALTH_EMERGENCY,
  AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
  AUTONOMY_REASON_NONE,
  AUTONOMY_REASON_OFFER_EMPTY_BUCKET,
  AUTONOMY_REASON_OFFER_SELECTED,
  AUTONOMY_REASON_PATH_NO_ROUTE,
  AUTONOMY_REASON_PATH_SELECTED,
  AUTONOMY_REASON_REF_NONE,
  AUTONOMY_REASON_RESERVATION_ACQUIRED,
  AUTONOMY_REASON_RESERVATION_CONFLICT,
  AUTONOMY_REASON_SOURCE_IDLE,
  AUTONOMY_REASON_SOURCE_NONE,
  AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
  AUTONOMY_SUGGESTION_NONE,
  isAutonomyReasonCode,
  isOptionalEntityRef,
  isStoredGeneration,
  isUint32,
  isValidAutonomyReason,
  isValidAutonomyReasonFields,
  resetAutonomyReason,
  type AutonomyReasonCode,
  type AutonomyReasonOutput,
  type AutonomyReasonSource,
  type AutonomySuggestion,
} from "./game-session-autonomy-reasons";
import {
  AUTONOMY_MAX_CLAIM_REFS,
  AUTONOMY_MAX_ROUTE_CELLS,
  AUTONOMY_INTERRUPTION_POLICY_NONE,
  AUTONOMY_REF_NONE,
  AUTONOMY_STATE_BLOCKED,
  AUTONOMY_STATE_CLAIMING,
  AUTONOMY_STATE_COMPLETED,
  AUTONOMY_STATE_FAILED,
  AUTONOMY_STATE_IDLE,
  AUTONOMY_STATE_INTERRUPTED,
  AUTONOMY_STATE_MOVING,
  AUTONOMY_STATE_WORKING,
  AUTONOMY_STORE_ALREADY_REGISTERED,
  AUTONOMY_STORE_BASIS_INVALID,
  AUTONOMY_STORE_CLAIM_CAPACITY,
  AUTONOMY_STORE_GENERATION_MISMATCH,
  AUTONOMY_STORE_ILLEGAL_TRANSITION,
  AUTONOMY_STORE_NOT_REGISTERED,
  AUTONOMY_STORE_OK,
  AUTONOMY_STORE_REASON_INVALID,
  AUTONOMY_STORE_REFERENCE_INVALID,
  AUTONOMY_STORE_RESIDENT_OUT_OF_RANGE,
  AUTONOMY_STORE_RETRY_TICK_INVALID,
  AUTONOMY_STORE_ROUTE_CAPACITY,
  AUTONOMY_STORE_ROW_VERSION_MISMATCH,
  AUTONOMY_STORE_SNAPSHOT_SHAPE,
  AUTONOMY_STORE_SNAPSHOT_STATE,
  AUTONOMY_STORE_SNAPSHOT_VERSION,
  AUTONOMY_STORE_STATE_MISMATCH,
  AUTONOMY_STORE_TICK_INVALID,
  AUTONOMY_STORE_VERSION_EXHAUSTED,
  AutonomySnapshotLane,
  AutonomySnapshotReasonParameterLane,
  AutonomySnapshotTickLane,
  RESIDENT_AUTONOMY_SNAPSHOT_VERSION,
  type AutonomyState,
  type AutonomyInterruptionPolicyCode,
  type AutonomyStoreCode,
  type AutonomyStoreOutput,
  type AutonomyTransitionInput,
  type AutonomyVersionBasis,
  type ResidentAutonomyReadOutput,
  type ResidentAutonomySnapshot,
} from "./game-session-autonomy-types";
import { isSafeTick } from "./time";

const L_GENERATION = AutonomySnapshotLane.residentGeneration,
  L_STATE = AutonomySnapshotLane.state,
  L_OFFER = AutonomySnapshotLane.offerId,
  L_JOB = AutonomySnapshotLane.jobId,
  L_TARGET_INDEX = AutonomySnapshotLane.targetEntityIndex,
  L_TARGET_GENERATION = AutonomySnapshotLane.targetEntityGeneration,
  L_TARGET_CELL = AutonomySnapshotLane.targetCellIndex,
  L_ROUTE_COUNT = AutonomySnapshotLane.routeCellCount,
  L_ROUTE_CURSOR = AutonomySnapshotLane.routeCursor,
  L_CLAIM_COUNT = AutonomySnapshotLane.claimCount,
  L_NEED_LANE = AutonomySnapshotLane.needLane,
  L_NEED_VALUE = AutonomySnapshotLane.needValue,
  L_ABILITY = AutonomySnapshotLane.ability,
  L_SCHEDULE = AutonomySnapshotLane.scheduleCode,
  L_BASIS = AutonomySnapshotLane.needOwnerVersion,
  L_ROW_VERSION = AutonomySnapshotLane.rowVersion,
  L_REASON = AutonomySnapshotLane.reasonCode,
  L_TERMINAL_PRESENT = AutonomySnapshotLane.terminalPresent,
  L_TERMINAL_STATE = AutonomySnapshotLane.terminalState,
  L_TERMINAL_OFFER = AutonomySnapshotLane.terminalOfferId,
  L_TERMINAL_JOB = AutonomySnapshotLane.terminalJobId,
  L_TERMINAL_TARGET_INDEX = AutonomySnapshotLane.terminalTargetEntityIndex,
  L_TERMINAL_TARGET_GENERATION = AutonomySnapshotLane.terminalTargetEntityGeneration,
  L_TERMINAL_TARGET_CELL = AutonomySnapshotLane.terminalTargetCellIndex,
  L_TERMINAL_REASON = AutonomySnapshotLane.terminalReasonCode,
  L_TERMINAL_INTERRUPTION_POLICY = AutonomySnapshotLane.terminalInterruptionPolicyCode,
  L_TERMINAL_JOB_VERSION = AutonomySnapshotLane.terminalJobVersion;
const L_INTERRUPTION_POLICY = AutonomySnapshotLane.interruptionPolicyCode;
const L_PENDING_JOB = AutonomySnapshotLane.pendingJobId;
const LANE_COUNT: number = AutonomySnapshotLane.count;
const R_CODE = 0,
  R_SOURCE = 1,
  R_SUBJECT_INDEX = 2,
  R_SUBJECT_GENERATION = 3,
  R_TARGET_INDEX = 4,
  R_TARGET_GENERATION = 5,
  R_PARAMETER_COUNT = 6,
  R_OWNER_BASIS = 7,
  R_SUGGESTION = 8;
const P_CURRENT = AutonomySnapshotReasonParameterLane.current0,
  P_TERMINAL = AutonomySnapshotReasonParameterLane.terminal0;
const PARAMETER_LANE_COUNT = 12;
const T_STATE_ENTERED = AutonomySnapshotTickLane.stateEntered,
  T_RETRY = AutonomySnapshotTickLane.retry,
  T_TERMINAL = AutonomySnapshotTickLane.terminal;
const TICK_LANE_COUNT = 3;
const TRANSITIONS_IDLE = (1 << AUTONOMY_STATE_CLAIMING) | (1 << AUTONOMY_STATE_INTERRUPTED);
const TRANSITIONS_CLAIMING =
  (1 << AUTONOMY_STATE_MOVING) |
  (1 << AUTONOMY_STATE_WORKING) |
  (1 << AUTONOMY_STATE_BLOCKED) |
  (1 << AUTONOMY_STATE_FAILED) |
  (1 << AUTONOMY_STATE_INTERRUPTED);
const TRANSITIONS_MOVING =
  (1 << AUTONOMY_STATE_WORKING) |
  (1 << AUTONOMY_STATE_BLOCKED) |
  (1 << AUTONOMY_STATE_FAILED) |
  (1 << AUTONOMY_STATE_INTERRUPTED);
const TRANSITIONS_WORKING =
  (1 << AUTONOMY_STATE_COMPLETED) |
  (1 << AUTONOMY_STATE_BLOCKED) |
  (1 << AUTONOMY_STATE_FAILED) |
  (1 << AUTONOMY_STATE_INTERRUPTED);
const TRANSITIONS_BLOCKED =
  (1 << AUTONOMY_STATE_CLAIMING) |
  (1 << AUTONOMY_STATE_MOVING) |
  (1 << AUTONOMY_STATE_WORKING) |
  (1 << AUTONOMY_STATE_IDLE) |
  (1 << AUTONOMY_STATE_FAILED) |
  (1 << AUTONOMY_STATE_INTERRUPTED);
const TRANSITIONS_INTERRUPTED = (1 << AUTONOMY_STATE_IDLE) | (1 << AUTONOMY_STATE_CLAIMING);
const TRANSITIONS_TERMINAL = 1 << AUTONOMY_STATE_IDLE;

export class ResidentAutonomyStore {
  readonly capacity: number;
  private readonly active: Uint8Array;
  private readonly lanes: Uint32Array;
  private readonly reasonParameters: Int32Array;
  private readonly ticks: Float64Array;
  private readonly routeCells: Uint32Array;
  private readonly claimIds: Uint32Array;
  private storeVersion = 0;
  private activeCountValue = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "resident autonomy capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.lanes = new Uint32Array(capacity * LANE_COUNT);
    this.reasonParameters = new Int32Array(capacity * PARAMETER_LANE_COUNT);
    this.ticks = new Float64Array(capacity * TICK_LANE_COUNT);
    this.routeCells = new Uint32Array(capacity * AUTONOMY_MAX_ROUTE_CELLS);
    this.claimIds = new Uint32Array(capacity * AUTONOMY_MAX_CLAIM_REFS);
    this.routeCells.fill(AUTONOMY_REF_NONE);
    this.claimIds.fill(AUTONOMY_REF_NONE);
  }

  get version(): number {
    return this.storeVersion;
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  registerResidentInto(
    residentIndex: number,
    residentGeneration: number,
    tick: number,
    output: AutonomyStoreOutput,
  ): void {
    resetStoreOutput(output, residentIndex, residentGeneration, this.storeVersion);
    if (!isResidentIndex(residentIndex, this.capacity)) {
      output.code = AUTONOMY_STORE_RESIDENT_OUT_OF_RANGE;
      return;
    }
    if (!isStoredGeneration(residentGeneration)) {
      output.code = AUTONOMY_STORE_GENERATION_MISMATCH;
      return;
    }
    if (!isSafeTick(tick)) {
      output.code = AUTONOMY_STORE_TICK_INVALID;
      return;
    }
    if ((this.active[residentIndex] ?? 0) === 1) {
      output.code = AUTONOMY_STORE_ALREADY_REGISTERED;
      return;
    }
    if (this.storeVersion >= 0xffff_ffff) {
      output.code = AUTONOMY_STORE_VERSION_EXHAUSTED;
      return;
    }
    this.initializeRow(residentIndex, residentGeneration, tick);
    this.active[residentIndex] = 1;
    this.activeCountValue += 1;
    this.storeVersion += 1;
    finishStoreOutput(output, AUTONOMY_STATE_IDLE, 1, this.storeVersion);
  }

  validateTransitionInto(input: AutonomyTransitionInput, output: AutonomyStoreOutput): void {
    resetStoreOutput(output, input.residentIndex, input.residentGeneration, this.storeVersion);
    this.validateTransition(input, output);
  }

  transitionInto(input: AutonomyTransitionInput, output: AutonomyStoreOutput): void {
    this.validateTransitionInto(input, output);
    if (!output.ok) return;
    const base = input.residentIndex * LANE_COUNT;
    writeExecutionLanes(this.lanes, base, input);
    writeBasis(this.lanes, base + L_BASIS, input.basis);
    writeStoredReason(
      this.lanes,
      this.reasonParameters,
      base + L_REASON,
      input.residentIndex,
      P_CURRENT,
      input.reason,
    );
    this.writeRouteAndClaims(input);
    const tickBase = input.residentIndex * TICK_LANE_COUNT;
    this.ticks[tickBase + T_STATE_ENTERED] = input.stateEnteredTick;
    this.ticks[tickBase + T_RETRY] = input.retryTick;
    const rowVersion = input.expectedRowVersion + 1;
    this.lanes[base + L_ROW_VERSION] = rowVersion;
    if (isTerminalState(input.nextState)) this.writeTerminal(input, base);
    this.storeVersion += 1;
    finishStoreOutput(output, input.nextState, rowVersion, this.storeVersion);
  }

  readResidentInto(
    residentIndex: number,
    residentGeneration: number,
    output: ResidentAutonomyReadOutput,
  ): void {
    resetReadOutput(output, residentIndex, residentGeneration, this.storeVersion);
    if (!isResidentIndex(residentIndex, this.capacity)) {
      output.code = AUTONOMY_STORE_RESIDENT_OUT_OF_RANGE;
      return;
    }
    if ((this.active[residentIndex] ?? 0) !== 1) {
      output.code = AUTONOMY_STORE_NOT_REGISTERED;
      return;
    }
    const base = residentIndex * LANE_COUNT;
    if ((this.lanes[base + L_GENERATION] ?? 0) !== residentGeneration) {
      output.code = AUTONOMY_STORE_GENERATION_MISMATCH;
      return;
    }
    const routeCount = this.lanes[base + L_ROUTE_COUNT] ?? 0;
    const claimCount = this.lanes[base + L_CLAIM_COUNT] ?? 0;
    if (output.routeCells.length < AUTONOMY_MAX_ROUTE_CELLS) {
      output.code = AUTONOMY_STORE_ROUTE_CAPACITY;
      return;
    }
    if (output.claimIds.length < AUTONOMY_MAX_CLAIM_REFS) {
      output.code = AUTONOMY_STORE_CLAIM_CAPACITY;
      return;
    }
    readExecutionLanes(this.lanes, this.ticks, base, residentIndex, output);
    readBasis(this.lanes, base + L_BASIS, output.basis);
    readStoredReason(
      this.lanes,
      this.reasonParameters,
      base + L_REASON,
      residentIndex,
      P_CURRENT,
      output.reason,
    );
    this.readRouteAndClaims(residentIndex, routeCount, claimCount, output);
    readTerminal(this.lanes, this.reasonParameters, this.ticks, base, residentIndex, output);
    output.ok = true;
    output.code = AUTONOMY_STORE_OK;
  }

  createSnapshot(): ResidentAutonomySnapshot {
    return {
      snapshotVersion: RESIDENT_AUTONOMY_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      active: this.active.slice(),
      lanes: this.lanes.slice(),
      reasonParameters: this.reasonParameters.slice(),
      ticks: this.ticks.slice(),
      routeCells: this.routeCells.slice(),
      claimIds: this.claimIds.slice(),
    };
  }

  restoreFromSnapshot(snapshot: ResidentAutonomySnapshot, output: AutonomyStoreOutput): void {
    resetStoreOutput(output, AUTONOMY_REF_NONE, AUTONOMY_REF_NONE, this.storeVersion);
    const stableSnapshot = copySnapshotForRestore(snapshot);
    if (stableSnapshot === undefined) {
      output.code = AUTONOMY_STORE_SNAPSHOT_SHAPE;
      return;
    }
    const shapeCode = validateSnapshotShape(stableSnapshot, this.capacity);
    if (shapeCode !== AUTONOMY_STORE_OK) {
      output.code = shapeCode;
      return;
    }
    if (!validateSnapshotRows(stableSnapshot)) {
      output.code = AUTONOMY_STORE_SNAPSHOT_STATE;
      return;
    }
    this.active.set(stableSnapshot.active);
    this.lanes.set(stableSnapshot.lanes);
    this.reasonParameters.set(stableSnapshot.reasonParameters);
    this.ticks.set(stableSnapshot.ticks);
    this.routeCells.set(stableSnapshot.routeCells);
    this.claimIds.set(stableSnapshot.claimIds);
    this.storeVersion = stableSnapshot.storeVersion;
    this.activeCountValue = countActive(stableSnapshot.active);
    finishStoreOutput(output, AUTONOMY_STATE_IDLE, 0, this.storeVersion);
  }

  private validateTransition(input: AutonomyTransitionInput, output: AutonomyStoreOutput): void {
    const residentCode = this.validateResident(input);
    if (residentCode !== AUTONOMY_STORE_OK) {
      output.code = residentCode;
      return;
    }
    const base = input.residentIndex * LANE_COUNT;
    const currentState = readState(this.lanes[base + L_STATE] ?? AUTONOMY_STATE_IDLE);
    const rowVersion = this.lanes[base + L_ROW_VERSION] ?? 0;
    const currentStateTick =
      this.ticks[input.residentIndex * TICK_LANE_COUNT + T_STATE_ENTERED] ?? 0;
    output.previousState = currentState;
    output.nextState = input.nextState;
    output.rowVersion = rowVersion;
    if (!isAutonomyState(input.expectedState) || !isAutonomyState(input.nextState))
      output.code = AUTONOMY_STORE_ILLEGAL_TRANSITION;
    else if (currentState !== input.expectedState) output.code = AUTONOMY_STORE_STATE_MISMATCH;
    else if (rowVersion !== input.expectedRowVersion)
      output.code = AUTONOMY_STORE_ROW_VERSION_MISMATCH;
    else if (!isLegalAutonomyTransition(currentState, input.nextState))
      output.code = AUTONOMY_STORE_ILLEGAL_TRANSITION;
    else if (!isSafeTick(input.stateEnteredTick) || input.stateEnteredTick < currentStateTick)
      output.code = AUTONOMY_STORE_TICK_INVALID;
    else if (!isValidRetryTick(input.stateEnteredTick, input.retryTick))
      output.code = AUTONOMY_STORE_RETRY_TICK_INVALID;
    else if (!isValidAutonomyReason(input.reason) || !validateTransitionReasonSemantics(input))
      output.code = AUTONOMY_STORE_REASON_INVALID;
    else {
      const referenceCode = validateTransitionReferences(input);
      if (referenceCode !== AUTONOMY_STORE_OK) output.code = referenceCode;
      else if (
        !isValidBasis(input.basis) ||
        !isValidJobPolicyBinding(
          input.jobId,
          input.interruptionPolicyCode,
          input.basis.jobVersion,
        ) ||
        !isValidJobPolicyContinuity(this.lanes, base, input)
      )
        output.code = AUTONOMY_STORE_BASIS_INVALID;
      else if (this.storeVersion >= 0xffff_ffff || rowVersion >= 0xffff_ffff) {
        output.code = AUTONOMY_STORE_VERSION_EXHAUSTED;
      } else output.ok = true;
    }
  }

  private validateResident(input: AutonomyTransitionInput): AutonomyStoreCode {
    if (!isResidentIndex(input.residentIndex, this.capacity))
      return AUTONOMY_STORE_RESIDENT_OUT_OF_RANGE;
    if ((this.active[input.residentIndex] ?? 0) !== 1) return AUTONOMY_STORE_NOT_REGISTERED;
    const base = input.residentIndex * LANE_COUNT;
    return (this.lanes[base + L_GENERATION] ?? 0) === input.residentGeneration
      ? AUTONOMY_STORE_OK
      : AUTONOMY_STORE_GENERATION_MISMATCH;
  }

  private initializeRow(residentIndex: number, residentGeneration: number, tick: number): void {
    const base = residentIndex * LANE_COUNT;
    this.lanes.fill(0, base, base + LANE_COUNT);
    this.reasonParameters.fill(
      0,
      residentIndex * PARAMETER_LANE_COUNT,
      (residentIndex + 1) * PARAMETER_LANE_COUNT,
    );
    this.ticks.fill(0, residentIndex * TICK_LANE_COUNT, (residentIndex + 1) * TICK_LANE_COUNT);
    this.lanes[base + L_GENERATION] = residentGeneration;
    this.lanes[base + L_STATE] = AUTONOMY_STATE_IDLE;
    setExecutionRefsNone(this.lanes, base);
    this.lanes[base + L_ROW_VERSION] = 1;
    writeInitialReason(this.lanes, base + L_REASON, residentIndex, residentGeneration);
    this.lanes[base + L_TERMINAL_STATE] = AUTONOMY_STATE_IDLE;
    this.lanes[base + L_TERMINAL_OFFER] = AUTONOMY_REF_NONE;
    this.lanes[base + L_TERMINAL_JOB] = AUTONOMY_REF_NONE;
    this.lanes[base + L_TERMINAL_TARGET_INDEX] = AUTONOMY_REF_NONE;
    this.lanes[base + L_TERMINAL_TARGET_GENERATION] = AUTONOMY_REF_NONE;
    this.lanes[base + L_TERMINAL_TARGET_CELL] = AUTONOMY_REF_NONE;
    writeEmptyReason(this.lanes, base + L_TERMINAL_REASON);
    this.ticks[residentIndex * TICK_LANE_COUNT + T_STATE_ENTERED] = tick;
    this.clearRouteAndClaims(residentIndex);
  }

  private writeRouteAndClaims(input: AutonomyTransitionInput): void {
    this.clearRouteAndClaims(input.residentIndex);
    const routeBase = input.residentIndex * AUTONOMY_MAX_ROUTE_CELLS;
    for (let index = 0; index < input.routeCellCount; index += 1)
      this.routeCells[routeBase + index] = input.routeCells[index] ?? AUTONOMY_REF_NONE;
    const claimBase = input.residentIndex * AUTONOMY_MAX_CLAIM_REFS;
    for (let index = 0; index < input.claimCount; index += 1)
      this.claimIds[claimBase + index] = input.claimIds[index] ?? AUTONOMY_REF_NONE;
  }

  private clearRouteAndClaims(residentIndex: number): void {
    const routeBase = residentIndex * AUTONOMY_MAX_ROUTE_CELLS;
    const claimBase = residentIndex * AUTONOMY_MAX_CLAIM_REFS;
    this.routeCells.fill(AUTONOMY_REF_NONE, routeBase, routeBase + AUTONOMY_MAX_ROUTE_CELLS);
    this.claimIds.fill(AUTONOMY_REF_NONE, claimBase, claimBase + AUTONOMY_MAX_CLAIM_REFS);
  }

  private readRouteAndClaims(
    residentIndex: number,
    routeCount: number,
    claimCount: number,
    output: ResidentAutonomyReadOutput,
  ): void {
    output.routeCells.fill(AUTONOMY_REF_NONE, 0, AUTONOMY_MAX_ROUTE_CELLS);
    output.claimIds.fill(AUTONOMY_REF_NONE, 0, AUTONOMY_MAX_CLAIM_REFS);
    const routeBase = residentIndex * AUTONOMY_MAX_ROUTE_CELLS;
    for (let index = 0; index < routeCount; index += 1)
      output.routeCells[index] = this.routeCells[routeBase + index] ?? AUTONOMY_REF_NONE;
    const claimBase = residentIndex * AUTONOMY_MAX_CLAIM_REFS;
    for (let index = 0; index < claimCount; index += 1)
      output.claimIds[index] = this.claimIds[claimBase + index] ?? AUTONOMY_REF_NONE;
  }

  private writeTerminal(input: AutonomyTransitionInput, base: number): void {
    this.lanes[base + L_TERMINAL_PRESENT] = 1;
    this.lanes[base + L_TERMINAL_STATE] = input.nextState;
    this.lanes[base + L_TERMINAL_OFFER] = input.offerId;
    this.lanes[base + L_TERMINAL_JOB] = input.jobId;
    this.lanes[base + L_TERMINAL_INTERRUPTION_POLICY] = input.interruptionPolicyCode;
    this.lanes[base + L_TERMINAL_JOB_VERSION] = input.basis.jobVersion;
    this.lanes[base + L_TERMINAL_TARGET_INDEX] = input.targetEntityIndex;
    this.lanes[base + L_TERMINAL_TARGET_GENERATION] = input.targetEntityGeneration;
    this.lanes[base + L_TERMINAL_TARGET_CELL] = input.targetCellIndex;
    writeStoredReason(
      this.lanes,
      this.reasonParameters,
      base + L_TERMINAL_REASON,
      input.residentIndex,
      P_TERMINAL,
      input.reason,
    );
    this.ticks[input.residentIndex * TICK_LANE_COUNT + T_TERMINAL] = input.stateEnteredTick;
  }
}

export function isLegalAutonomyTransition(from: AutonomyState, to: AutonomyState): boolean {
  return (readLegalTransitionMask(from) & (1 << to)) !== 0;
}

function readLegalTransitionMask(state: AutonomyState): number {
  if (state === AUTONOMY_STATE_IDLE) return TRANSITIONS_IDLE;
  if (state === AUTONOMY_STATE_CLAIMING) return TRANSITIONS_CLAIMING;
  if (state === AUTONOMY_STATE_MOVING) return TRANSITIONS_MOVING;
  if (state === AUTONOMY_STATE_WORKING) return TRANSITIONS_WORKING;
  if (state === AUTONOMY_STATE_BLOCKED) return TRANSITIONS_BLOCKED;
  if (state === AUTONOMY_STATE_INTERRUPTED) return TRANSITIONS_INTERRUPTED;
  return TRANSITIONS_TERMINAL;
}

function validateTransitionReferences(input: AutonomyTransitionInput): AutonomyStoreCode {
  const scalarCode = validateTransitionScalarReferences(input);
  if (scalarCode !== AUTONOMY_STORE_OK) return scalarCode;
  const routeClaimCode = validateTransitionRouteClaims(input);
  if (routeClaimCode !== AUTONOMY_STORE_OK) return routeClaimCode;
  return validateTransitionStateSemantics(input);
}

function validateTransitionScalarReferences(input: AutonomyTransitionInput): AutonomyStoreCode {
  if (
    !isOptionalScalar(input.offerId) ||
    !isOptionalScalar(input.jobId) ||
    !isOptionalScalar(input.pendingJobId) ||
    !isOptionalEntityRef(input.targetEntityIndex, input.targetEntityGeneration) ||
    !isOptionalScalar(input.targetCellIndex)
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    !isOptionalBounded(input.needLane, 5) ||
    !Number.isInteger(input.needValue) ||
    input.needValue < 0 ||
    input.needValue > 1_000 ||
    !isOptionalBounded(input.ability, 6) ||
    !isOptionalBounded(input.scheduleCode, 4)
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  return AUTONOMY_STORE_OK;
}

function validateTransitionRouteClaims(input: AutonomyTransitionInput): AutonomyStoreCode {
  if (
    !Number.isInteger(input.routeCellCount) ||
    input.routeCellCount < 0 ||
    input.routeCellCount > AUTONOMY_MAX_ROUTE_CELLS ||
    input.routeCells.length < input.routeCellCount ||
    !Number.isInteger(input.routeCursor) ||
    input.routeCursor < 0 ||
    input.routeCursor > input.routeCellCount
  )
    return AUTONOMY_STORE_ROUTE_CAPACITY;
  if (
    !Number.isInteger(input.claimCount) ||
    input.claimCount < 0 ||
    input.claimCount > AUTONOMY_MAX_CLAIM_REFS ||
    input.claimIds.length < input.claimCount
  )
    return AUTONOMY_STORE_CLAIM_CAPACITY;
  for (let index = 0; index < input.routeCellCount; index += 1)
    if (!isStoredRef(input.routeCells[index] ?? AUTONOMY_REF_NONE))
      return AUTONOMY_STORE_REFERENCE_INVALID;
  for (let index = 0; index < input.claimCount; index += 1)
    if (!isStoredRef(input.claimIds[index] ?? AUTONOMY_REF_NONE))
      return AUTONOMY_STORE_REFERENCE_INVALID;
  return AUTONOMY_STORE_OK;
}

function validateTransitionStateSemantics(input: AutonomyTransitionInput): AutonomyStoreCode {
  const hasTarget =
    input.targetEntityIndex !== AUTONOMY_REF_NONE || input.targetCellIndex !== AUTONOMY_REF_NONE;
  if (input.nextState !== AUTONOMY_STATE_IDLE && !hasTarget)
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    input.nextState === AUTONOMY_STATE_IDLE &&
    (input.offerId !== AUTONOMY_REF_NONE ||
      input.jobId !== AUTONOMY_REF_NONE ||
      input.pendingJobId !== AUTONOMY_REF_NONE ||
      hasTarget ||
      input.routeCellCount !== 0 ||
      input.claimCount !== 0)
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    input.nextState === AUTONOMY_STATE_CLAIMING &&
    (input.offerId === AUTONOMY_REF_NONE ||
      input.jobId !== AUTONOMY_REF_NONE ||
      !hasPairedRouteClaims(input.routeCellCount, input.claimCount) ||
      !hasValidPendingJobBinding(input.pendingJobId, input.routeCellCount))
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    input.nextState === AUTONOMY_STATE_MOVING &&
    (input.jobId === AUTONOMY_REF_NONE ||
      input.pendingJobId !== AUTONOMY_REF_NONE ||
      input.routeCellCount === 0 ||
      input.claimCount === 0)
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    input.nextState === AUTONOMY_STATE_WORKING &&
    (input.jobId === AUTONOMY_REF_NONE ||
      input.pendingJobId !== AUTONOMY_REF_NONE ||
      input.claimCount === 0)
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    input.nextState === AUTONOMY_STATE_BLOCKED &&
    !hasValidBlockedJobBinding(
      input.jobId,
      input.pendingJobId,
      input.routeCellCount,
      input.claimCount,
    )
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (input.nextState === AUTONOMY_STATE_COMPLETED && input.jobId === AUTONOMY_REF_NONE)
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    isTerminalState(input.nextState) &&
    (input.pendingJobId !== AUTONOMY_REF_NONE ||
      input.routeCellCount !== 0 ||
      input.claimCount !== 0)
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  if (
    (input.nextState === AUTONOMY_STATE_FAILED || input.nextState === AUTONOMY_STATE_INTERRUPTED) &&
    input.jobId === AUTONOMY_REF_NONE &&
    input.offerId === AUTONOMY_REF_NONE
  )
    return AUTONOMY_STORE_REFERENCE_INVALID;
  return AUTONOMY_STORE_OK;
}

function validateTransitionReasonSemantics(input: AutonomyTransitionInput): boolean {
  const reason = input.reason;
  if (!isReasonAllowedForState(input.nextState, reason.code)) return false;
  if (reason.code === AUTONOMY_REASON_NONE) return input.nextState === AUTONOMY_STATE_COMPLETED;
  if (
    reason.subjectIndex !== input.residentIndex ||
    reason.subjectGeneration !== input.residentGeneration
  )
    return false;
  if (!reasonTargetMatches(reason, input.targetEntityIndex, input.targetEntityGeneration))
    return false;
  return reason.ownerBasis === readReasonOwnerBasis(reason.code, input.basis);
}

function isReasonAllowedForState(state: AutonomyState, code: AutonomyReasonCode): boolean {
  if (state === AUTONOMY_STATE_IDLE) return isIdleOutcomeReason(code);
  if (state === AUTONOMY_STATE_CLAIMING)
    return (
      code === AUTONOMY_REASON_OFFER_SELECTED ||
      code === AUTONOMY_REASON_PATH_SELECTED ||
      code === AUTONOMY_REASON_RESERVATION_ACQUIRED
    );
  if (state === AUTONOMY_STATE_MOVING || state === AUTONOMY_STATE_WORKING)
    return (
      code === AUTONOMY_REASON_CAPABILITY_ALLOWED ||
      code === AUTONOMY_REASON_PATH_SELECTED ||
      code === AUTONOMY_REASON_RESERVATION_ACQUIRED
    );
  if (state === AUTONOMY_STATE_BLOCKED)
    return (
      code >= AUTONOMY_REASON_BLOCKED_TARGET_BUSY && code <= AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED
    );
  if (state === AUTONOMY_STATE_COMPLETED) return code === AUTONOMY_REASON_NONE;
  if (state === AUTONOMY_STATE_FAILED)
    return (
      code >= AUTONOMY_REASON_FAILED_TARGET_DESTROYED && code <= AUTONOMY_REASON_FAILED_INVARIANT
    );
  return (
    code >= AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY && code <= AUTONOMY_REASON_INTERRUPTED_DANGER
  );
}

function isIdleOutcomeReason(code: AutonomyReasonCode): boolean {
  if (code >= AUTONOMY_REASON_IDLE_OFF_SHIFT && code <= AUTONOMY_REASON_IDLE_DECISION_DEFERRED)
    return true;
  if (
    code >= AUTONOMY_REASON_NEED_HUNGER_EMERGENCY &&
    code <= AUTONOMY_REASON_NEED_HEALTH_EMERGENCY
  )
    return true;
  if (
    code >= AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED &&
    code < AUTONOMY_REASON_CAPABILITY_ALLOWED
  )
    return true;
  if (code >= AUTONOMY_REASON_OFFER_EMPTY_BUCKET && code < AUTONOMY_REASON_OFFER_SELECTED)
    return true;
  if (code >= AUTONOMY_REASON_PATH_NO_ROUTE && code < AUTONOMY_REASON_PATH_SELECTED) return true;
  return (
    code >= AUTONOMY_REASON_RESERVATION_CONFLICT && code < AUTONOMY_REASON_RESERVATION_ACQUIRED
  );
}

function reasonTargetMatches(
  reason: AutonomyReasonOutput,
  targetIndex: number,
  targetGeneration: number,
): boolean {
  if (reason.targetIndex === AUTONOMY_REASON_REF_NONE)
    return reason.targetGeneration === AUTONOMY_REASON_REF_NONE;
  return reason.targetIndex === targetIndex && reason.targetGeneration === targetGeneration;
}

function readReasonOwnerBasis(code: AutonomyReasonCode, basis: AutonomyVersionBasis): number {
  if (code === AUTONOMY_REASON_IDLE_OFF_SHIFT) return basis.scheduleVersion;
  if (code === AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER) return basis.offerIndexVersion;
  if (
    code === AUTONOMY_REASON_IDLE_RETRY_BACKOFF ||
    code === AUTONOMY_REASON_IDLE_DECISION_DEFERRED
  )
    return 0;
  if (
    code >= AUTONOMY_REASON_NEED_HUNGER_EMERGENCY &&
    code <= AUTONOMY_REASON_NEED_HEALTH_EMERGENCY
  )
    return basis.needOwnerVersion;
  if (
    code >= AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED &&
    code <= AUTONOMY_REASON_CAPABILITY_ALLOWED
  )
    return basis.capabilityConditionVersion;
  if (code >= AUTONOMY_REASON_OFFER_EMPTY_BUCKET && code <= AUTONOMY_REASON_OFFER_SELECTED)
    return code === AUTONOMY_REASON_OFFER_SELECTED
      ? basis.offerOwnerVersion
      : basis.offerIndexVersion;
  if (code >= AUTONOMY_REASON_PATH_NO_ROUTE && code <= AUTONOMY_REASON_PATH_SELECTED)
    return basis.pathMapVersion;
  if (code >= AUTONOMY_REASON_RESERVATION_CONFLICT && code <= AUTONOMY_REASON_RESERVATION_ACQUIRED)
    return basis.reservationVersion;
  if (code === AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED) return basis.scheduleVersion;
  if (code === AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY) return basis.needOwnerVersion;
  if (code === AUTONOMY_REASON_INTERRUPTED_SHIFT_END) return basis.scheduleVersion;
  return basis.jobVersion > 0 ? basis.jobVersion : basis.offerOwnerVersion;
}

function writeExecutionLanes(
  lanes: Uint32Array,
  base: number,
  input: AutonomyTransitionInput,
): void {
  lanes[base + L_STATE] = input.nextState;
  lanes[base + L_OFFER] = input.offerId;
  lanes[base + L_JOB] = input.jobId;
  lanes[base + L_PENDING_JOB] = input.pendingJobId;
  lanes[base + L_INTERRUPTION_POLICY] = input.interruptionPolicyCode;
  lanes[base + L_TARGET_INDEX] = input.targetEntityIndex;
  lanes[base + L_TARGET_GENERATION] = input.targetEntityGeneration;
  lanes[base + L_TARGET_CELL] = input.targetCellIndex;
  lanes[base + L_ROUTE_COUNT] = input.routeCellCount;
  lanes[base + L_ROUTE_CURSOR] = input.routeCursor;
  lanes[base + L_CLAIM_COUNT] = input.claimCount;
  lanes[base + L_NEED_LANE] = input.needLane;
  lanes[base + L_NEED_VALUE] = input.needValue;
  lanes[base + L_ABILITY] = input.ability;
  lanes[base + L_SCHEDULE] = input.scheduleCode;
}

function readExecutionLanes(
  lanes: Uint32Array,
  ticks: Float64Array,
  base: number,
  residentIndex: number,
  output: ResidentAutonomyReadOutput,
): void {
  output.residentGeneration = lanes[base + L_GENERATION] ?? AUTONOMY_REF_NONE;
  output.state = readState(lanes[base + L_STATE] ?? 0);
  output.offerId = lanes[base + L_OFFER] ?? AUTONOMY_REF_NONE;
  output.jobId = lanes[base + L_JOB] ?? AUTONOMY_REF_NONE;
  output.pendingJobId = lanes[base + L_PENDING_JOB] ?? AUTONOMY_REF_NONE;
  output.interruptionPolicyCode = readInterruptionPolicyCode(
    lanes[base + L_INTERRUPTION_POLICY] ?? AUTONOMY_INTERRUPTION_POLICY_NONE,
  );
  output.targetEntityIndex = lanes[base + L_TARGET_INDEX] ?? AUTONOMY_REF_NONE;
  output.targetEntityGeneration = lanes[base + L_TARGET_GENERATION] ?? AUTONOMY_REF_NONE;
  output.targetCellIndex = lanes[base + L_TARGET_CELL] ?? AUTONOMY_REF_NONE;
  output.routeCellCount = lanes[base + L_ROUTE_COUNT] ?? 0;
  output.routeCursor = lanes[base + L_ROUTE_CURSOR] ?? 0;
  output.claimCount = lanes[base + L_CLAIM_COUNT] ?? 0;
  output.needLane = lanes[base + L_NEED_LANE] ?? AUTONOMY_REF_NONE;
  output.needValue = lanes[base + L_NEED_VALUE] ?? 0;
  output.ability = lanes[base + L_ABILITY] ?? AUTONOMY_REF_NONE;
  output.scheduleCode = lanes[base + L_SCHEDULE] ?? AUTONOMY_REF_NONE;
  output.rowVersion = lanes[base + L_ROW_VERSION] ?? 0;
  const tickBase = residentIndex * TICK_LANE_COUNT;
  output.stateEnteredTick = ticks[tickBase + T_STATE_ENTERED] ?? 0;
  output.retryTick = ticks[tickBase + T_RETRY] ?? 0;
}

function writeBasis(lanes: Uint32Array, base: number, basis: AutonomyVersionBasis): void {
  lanes[base] = basis.needOwnerVersion;
  lanes[base + 1] = basis.scheduleVersion;
  lanes[base + 2] = basis.capabilityConditionVersion;
  lanes[base + 3] = basis.capabilityBaseVersion;
  lanes[base + 4] = basis.offerOwnerVersion;
  lanes[base + 5] = basis.offerRowVersion;
  lanes[base + 6] = basis.offerIndexVersion;
  lanes[base + 7] = basis.pathMapVersion;
  lanes[base + 8] = basis.pathNavigationVersion;
  lanes[base + 9] = basis.pathRegionVersion;
  lanes[base + 10] = basis.pathRoomVersion;
  lanes[base + 11] = basis.pathRegionGraphVersion;
  lanes[base + 12] = basis.reservationVersion;
  lanes[base + 13] = basis.jobVersion;
}

function readBasis(lanes: Uint32Array, base: number, basis: AutonomyVersionBasis): void {
  basis.needOwnerVersion = lanes[base] ?? 0;
  basis.scheduleVersion = lanes[base + 1] ?? 0;
  basis.capabilityConditionVersion = lanes[base + 2] ?? 0;
  basis.capabilityBaseVersion = lanes[base + 3] ?? 0;
  basis.offerOwnerVersion = lanes[base + 4] ?? 0;
  basis.offerRowVersion = lanes[base + 5] ?? 0;
  basis.offerIndexVersion = lanes[base + 6] ?? 0;
  basis.pathMapVersion = lanes[base + 7] ?? 0;
  basis.pathNavigationVersion = lanes[base + 8] ?? 0;
  basis.pathRegionVersion = lanes[base + 9] ?? 0;
  basis.pathRoomVersion = lanes[base + 10] ?? 0;
  basis.pathRegionGraphVersion = lanes[base + 11] ?? 0;
  basis.reservationVersion = lanes[base + 12] ?? 0;
  basis.jobVersion = lanes[base + 13] ?? 0;
}

function writeStoredReason(
  lanes: Uint32Array,
  parameters: Int32Array,
  base: number,
  residentIndex: number,
  parameterOffset: number,
  reason: AutonomyReasonOutput,
): void {
  lanes[base + R_CODE] = reason.code;
  lanes[base + R_SOURCE] = reason.source;
  lanes[base + R_SUBJECT_INDEX] = reason.subjectIndex;
  lanes[base + R_SUBJECT_GENERATION] = reason.subjectGeneration;
  lanes[base + R_TARGET_INDEX] = reason.targetIndex;
  lanes[base + R_TARGET_GENERATION] = reason.targetGeneration;
  lanes[base + R_PARAMETER_COUNT] = reason.parameterCount;
  lanes[base + R_OWNER_BASIS] = reason.ownerBasis;
  lanes[base + R_SUGGESTION] = reason.suggestion;
  const parameterBase = residentIndex * PARAMETER_LANE_COUNT + parameterOffset;
  parameters[parameterBase] = reason.parameter0;
  parameters[parameterBase + 1] = reason.parameter1;
  parameters[parameterBase + 2] = reason.parameter2;
  parameters[parameterBase + 3] = reason.parameter3;
  parameters[parameterBase + 4] = reason.parameter4;
  parameters[parameterBase + 5] = reason.parameter5;
}

function readStoredReason(
  lanes: Uint32Array,
  parameters: Int32Array,
  base: number,
  residentIndex: number,
  parameterOffset: number,
  output: AutonomyReasonOutput,
): void {
  const code = lanes[base + R_CODE] ?? AUTONOMY_REASON_NONE;
  output.code = isAutonomyReasonCode(code) ? code : AUTONOMY_REASON_NONE;
  output.source = readReasonSource(lanes[base + R_SOURCE] ?? 0);
  output.subjectIndex = lanes[base + R_SUBJECT_INDEX] ?? AUTONOMY_REASON_REF_NONE;
  output.subjectGeneration = lanes[base + R_SUBJECT_GENERATION] ?? AUTONOMY_REASON_REF_NONE;
  output.targetIndex = lanes[base + R_TARGET_INDEX] ?? AUTONOMY_REASON_REF_NONE;
  output.targetGeneration = lanes[base + R_TARGET_GENERATION] ?? AUTONOMY_REASON_REF_NONE;
  output.parameterCount = lanes[base + R_PARAMETER_COUNT] ?? 0;
  output.ownerBasis = lanes[base + R_OWNER_BASIS] ?? 0;
  output.suggestion = readSuggestion(lanes[base + R_SUGGESTION] ?? 0);
  const parameterBase = residentIndex * PARAMETER_LANE_COUNT + parameterOffset;
  output.parameter0 = parameters[parameterBase] ?? 0;
  output.parameter1 = parameters[parameterBase + 1] ?? 0;
  output.parameter2 = parameters[parameterBase + 2] ?? 0;
  output.parameter3 = parameters[parameterBase + 3] ?? 0;
  output.parameter4 = parameters[parameterBase + 4] ?? 0;
  output.parameter5 = parameters[parameterBase + 5] ?? 0;
}

function readTerminal(
  lanes: Uint32Array,
  parameters: Int32Array,
  ticks: Float64Array,
  base: number,
  residentIndex: number,
  output: ResidentAutonomyReadOutput,
): void {
  output.terminal.present = (lanes[base + L_TERMINAL_PRESENT] ?? 0) === 1;
  output.terminal.state = readState(lanes[base + L_TERMINAL_STATE] ?? 0);
  output.terminal.offerId = lanes[base + L_TERMINAL_OFFER] ?? AUTONOMY_REF_NONE;
  output.terminal.jobId = lanes[base + L_TERMINAL_JOB] ?? AUTONOMY_REF_NONE;
  output.terminal.interruptionPolicyCode = readInterruptionPolicyCode(
    lanes[base + L_TERMINAL_INTERRUPTION_POLICY] ?? AUTONOMY_INTERRUPTION_POLICY_NONE,
  );
  output.terminal.jobVersion = lanes[base + L_TERMINAL_JOB_VERSION] ?? 0;
  output.terminal.targetEntityIndex = lanes[base + L_TERMINAL_TARGET_INDEX] ?? AUTONOMY_REF_NONE;
  output.terminal.targetEntityGeneration =
    lanes[base + L_TERMINAL_TARGET_GENERATION] ?? AUTONOMY_REF_NONE;
  output.terminal.targetCellIndex = lanes[base + L_TERMINAL_TARGET_CELL] ?? AUTONOMY_REF_NONE;
  output.terminal.tick = ticks[residentIndex * TICK_LANE_COUNT + T_TERMINAL] ?? 0;
  readStoredReason(
    lanes,
    parameters,
    base + L_TERMINAL_REASON,
    residentIndex,
    P_TERMINAL,
    output.terminal.reason,
  );
}

function resetStoreOutput(
  output: AutonomyStoreOutput,
  residentIndex: number,
  residentGeneration: number,
  storeVersion: number,
): void {
  output.ok = false;
  output.code = AUTONOMY_STORE_OK;
  output.residentIndex = residentIndex;
  output.residentGeneration = residentGeneration;
  output.previousState = AUTONOMY_STATE_IDLE;
  output.nextState = AUTONOMY_STATE_IDLE;
  output.rowVersion = 0;
  output.storeVersion = storeVersion;
}

function finishStoreOutput(
  output: AutonomyStoreOutput,
  state: AutonomyState,
  rowVersion: number,
  storeVersion: number,
): void {
  output.ok = true;
  output.code = AUTONOMY_STORE_OK;
  output.nextState = state;
  output.rowVersion = rowVersion;
  output.storeVersion = storeVersion;
}

function resetReadOutput(
  output: ResidentAutonomyReadOutput,
  residentIndex: number,
  residentGeneration: number,
  storeVersion: number,
): void {
  output.ok = false;
  output.code = AUTONOMY_STORE_OK;
  output.residentIndex = residentIndex;
  output.residentGeneration = residentGeneration;
  output.state = AUTONOMY_STATE_IDLE;
  output.stateEnteredTick = 0;
  output.retryTick = 0;
  output.offerId = AUTONOMY_REF_NONE;
  output.jobId = AUTONOMY_REF_NONE;
  output.pendingJobId = AUTONOMY_REF_NONE;
  output.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_NONE;
  output.targetEntityIndex = AUTONOMY_REF_NONE;
  output.targetEntityGeneration = AUTONOMY_REF_NONE;
  output.targetCellIndex = AUTONOMY_REF_NONE;
  output.routeCellCount = 0;
  output.routeCursor = 0;
  output.routeCells.fill(AUTONOMY_REF_NONE);
  output.claimCount = 0;
  output.claimIds.fill(AUTONOMY_REF_NONE);
  output.needLane = AUTONOMY_REF_NONE;
  output.needValue = 0;
  output.ability = AUTONOMY_REF_NONE;
  output.scheduleCode = AUTONOMY_REF_NONE;
  output.rowVersion = 0;
  output.storeVersion = storeVersion;
  resetBasis(output.basis);
  resetAutonomyReason(output.reason);
  output.terminal.present = false;
  output.terminal.state = AUTONOMY_STATE_IDLE;
  output.terminal.tick = 0;
  output.terminal.offerId = AUTONOMY_REF_NONE;
  output.terminal.jobId = AUTONOMY_REF_NONE;
  output.terminal.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_NONE;
  output.terminal.jobVersion = 0;
  output.terminal.targetEntityIndex = AUTONOMY_REF_NONE;
  output.terminal.targetEntityGeneration = AUTONOMY_REF_NONE;
  output.terminal.targetCellIndex = AUTONOMY_REF_NONE;
  resetAutonomyReason(output.terminal.reason);
}

function resetBasis(basis: AutonomyVersionBasis): void {
  basis.needOwnerVersion = 0;
  basis.scheduleVersion = 0;
  basis.capabilityConditionVersion = 0;
  basis.capabilityBaseVersion = 0;
  basis.offerOwnerVersion = 0;
  basis.offerRowVersion = 0;
  basis.offerIndexVersion = 0;
  basis.pathMapVersion = 0;
  basis.pathNavigationVersion = 0;
  basis.pathRegionVersion = 0;
  basis.pathRoomVersion = 0;
  basis.pathRegionGraphVersion = 0;
  basis.reservationVersion = 0;
  basis.jobVersion = 0;
}

function setExecutionRefsNone(lanes: Uint32Array, base: number): void {
  lanes[base + L_OFFER] = AUTONOMY_REF_NONE;
  lanes[base + L_JOB] = AUTONOMY_REF_NONE;
  lanes[base + L_PENDING_JOB] = AUTONOMY_REF_NONE;
  lanes[base + L_INTERRUPTION_POLICY] = AUTONOMY_INTERRUPTION_POLICY_NONE;
  lanes[base + L_TARGET_INDEX] = AUTONOMY_REF_NONE;
  lanes[base + L_TARGET_GENERATION] = AUTONOMY_REF_NONE;
  lanes[base + L_TARGET_CELL] = AUTONOMY_REF_NONE;
  lanes[base + L_NEED_LANE] = AUTONOMY_REF_NONE;
  lanes[base + L_ABILITY] = AUTONOMY_REF_NONE;
  lanes[base + L_SCHEDULE] = AUTONOMY_REF_NONE;
}

function writeInitialReason(
  lanes: Uint32Array,
  base: number,
  residentIndex: number,
  residentGeneration: number,
): void {
  lanes[base + R_CODE] = AUTONOMY_REASON_IDLE_RETRY_BACKOFF;
  lanes[base + R_SOURCE] = AUTONOMY_REASON_SOURCE_IDLE;
  lanes[base + R_SUBJECT_INDEX] = residentIndex;
  lanes[base + R_SUBJECT_GENERATION] = residentGeneration;
  lanes[base + R_TARGET_INDEX] = AUTONOMY_REASON_REF_NONE;
  lanes[base + R_TARGET_GENERATION] = AUTONOMY_REASON_REF_NONE;
  lanes[base + R_PARAMETER_COUNT] = 0;
  lanes[base + R_OWNER_BASIS] = 0;
  lanes[base + R_SUGGESTION] = AUTONOMY_SUGGESTION_INSPECT_RESIDENT;
}

function writeEmptyReason(lanes: Uint32Array, base: number): void {
  lanes[base + R_CODE] = AUTONOMY_REASON_NONE;
  lanes[base + R_SOURCE] = AUTONOMY_REASON_SOURCE_NONE;
  lanes[base + R_SUBJECT_INDEX] = AUTONOMY_REASON_REF_NONE;
  lanes[base + R_SUBJECT_GENERATION] = AUTONOMY_REASON_REF_NONE;
  lanes[base + R_TARGET_INDEX] = AUTONOMY_REASON_REF_NONE;
  lanes[base + R_TARGET_GENERATION] = AUTONOMY_REASON_REF_NONE;
  lanes[base + R_PARAMETER_COUNT] = 0;
  lanes[base + R_OWNER_BASIS] = 0;
  lanes[base + R_SUGGESTION] = AUTONOMY_SUGGESTION_NONE;
}

function isValidBasis(basis: AutonomyVersionBasis): boolean {
  return (
    isUint32(basis.needOwnerVersion) &&
    isUint32(basis.scheduleVersion) &&
    isUint32(basis.capabilityConditionVersion) &&
    isUint32(basis.capabilityBaseVersion) &&
    isUint32(basis.offerOwnerVersion) &&
    isUint32(basis.offerRowVersion) &&
    isUint32(basis.offerIndexVersion) &&
    isUint32(basis.pathMapVersion) &&
    isUint32(basis.pathNavigationVersion) &&
    isUint32(basis.pathRegionVersion) &&
    isUint32(basis.pathRoomVersion) &&
    isUint32(basis.pathRegionGraphVersion) &&
    isUint32(basis.reservationVersion) &&
    isUint32(basis.jobVersion)
  );
}

function copySnapshotForRestore(
  snapshot: ResidentAutonomySnapshot,
): ResidentAutonomySnapshot | undefined {
  try {
    const active = snapshot.active;
    const lanes = snapshot.lanes;
    const reasonParameters = snapshot.reasonParameters;
    const ticks = snapshot.ticks;
    const routeCells = snapshot.routeCells;
    const claimIds = snapshot.claimIds;
    if (
      Object.getPrototypeOf(active) !== Uint8Array.prototype ||
      Object.getPrototypeOf(lanes) !== Uint32Array.prototype ||
      Object.getPrototypeOf(reasonParameters) !== Int32Array.prototype ||
      Object.getPrototypeOf(ticks) !== Float64Array.prototype ||
      Object.getPrototypeOf(routeCells) !== Uint32Array.prototype ||
      Object.getPrototypeOf(claimIds) !== Uint32Array.prototype
    )
      return undefined;
    return {
      snapshotVersion: snapshot.snapshotVersion,
      capacity: snapshot.capacity,
      storeVersion: snapshot.storeVersion,
      active: active.slice(),
      lanes: lanes.slice(),
      reasonParameters: reasonParameters.slice(),
      ticks: ticks.slice(),
      routeCells: routeCells.slice(),
      claimIds: claimIds.slice(),
    };
  } catch {
    return undefined;
  }
}

function validateSnapshotShape(
  snapshot: ResidentAutonomySnapshot,
  capacity: number,
): AutonomyStoreCode {
  if (snapshot.snapshotVersion !== RESIDENT_AUTONOMY_SNAPSHOT_VERSION)
    return AUTONOMY_STORE_SNAPSHOT_VERSION;
  if (
    snapshot.capacity !== capacity ||
    snapshot.active.length !== capacity ||
    snapshot.lanes.length !== capacity * LANE_COUNT ||
    snapshot.reasonParameters.length !== capacity * PARAMETER_LANE_COUNT ||
    snapshot.ticks.length !== capacity * TICK_LANE_COUNT ||
    snapshot.routeCells.length !== capacity * AUTONOMY_MAX_ROUTE_CELLS ||
    snapshot.claimIds.length !== capacity * AUTONOMY_MAX_CLAIM_REFS ||
    !isUint32(snapshot.storeVersion)
  )
    return AUTONOMY_STORE_SNAPSHOT_SHAPE;
  return AUTONOMY_STORE_OK;
}

function validateSnapshotRows(snapshot: ResidentAutonomySnapshot): boolean {
  for (let residentIndex = 0; residentIndex < snapshot.capacity; residentIndex += 1) {
    const active = snapshot.active[residentIndex] ?? 0;
    if (active !== 0 && active !== 1) return false;
    if (active === 1) {
      if (!validateStoredRow(snapshot, residentIndex)) return false;
    } else if (!validateInactiveRow(snapshot, residentIndex)) return false;
  }
  return true;
}

function validateStoredRow(snapshot: ResidentAutonomySnapshot, residentIndex: number): boolean {
  const base = residentIndex * LANE_COUNT;
  const state = snapshot.lanes[base + L_STATE] ?? 0;
  const routeCount = snapshot.lanes[base + L_ROUTE_COUNT] ?? 0;
  const routeCursor = snapshot.lanes[base + L_ROUTE_CURSOR] ?? 0;
  const claimCount = snapshot.lanes[base + L_CLAIM_COUNT] ?? 0;
  const rowVersion = snapshot.lanes[base + L_ROW_VERSION] ?? 0;
  const stateTick = snapshot.ticks[residentIndex * TICK_LANE_COUNT + T_STATE_ENTERED] ?? -1;
  const retryTick = snapshot.ticks[residentIndex * TICK_LANE_COUNT + T_RETRY] ?? -1;
  if (
    !isStoredGeneration(snapshot.lanes[base + L_GENERATION] ?? 0) ||
    !isAutonomyState(state) ||
    rowVersion === 0 ||
    rowVersion > snapshot.storeVersion
  )
    return false;
  if (!isSafeTick(stateTick) || !isValidRetryTick(stateTick, retryTick)) return false;
  if (
    routeCount > AUTONOMY_MAX_ROUTE_CELLS ||
    routeCursor > routeCount ||
    claimCount > AUTONOMY_MAX_CLAIM_REFS
  )
    return false;
  if (
    !validateStoredExecution(snapshot.lanes, base, state, routeCount, claimCount) ||
    !validateStoredReason(snapshot, residentIndex, base + L_REASON, P_CURRENT) ||
    !validateStoredCurrentReasonSemantics(snapshot, residentIndex, base, state)
  )
    return false;
  if (!validateStoredRouteClaims(snapshot, residentIndex, routeCount, claimCount)) return false;
  const terminalPresent = snapshot.lanes[base + L_TERMINAL_PRESENT] ?? 0;
  if (terminalPresent !== 0 && terminalPresent !== 1) return false;
  if (
    terminalPresent === 1 &&
    (snapshot.ticks[residentIndex * TICK_LANE_COUNT + T_TERMINAL] ?? 0) > stateTick
  )
    return false;
  if (!validateStoredTerminal(snapshot, residentIndex, base, terminalPresent)) return false;
  if (!validateCurrentTerminalBinding(snapshot, residentIndex, base, state, terminalPresent))
    return false;
  return true;
}

function validateStoredExecution(
  lanes: Uint32Array,
  base: number,
  state: number,
  routeCount: number,
  claimCount: number,
): boolean {
  const offerId = lanes[base + L_OFFER] ?? AUTONOMY_REF_NONE;
  const jobId = lanes[base + L_JOB] ?? AUTONOMY_REF_NONE;
  const pendingJobId = lanes[base + L_PENDING_JOB] ?? AUTONOMY_REF_NONE;
  const targetIndex = lanes[base + L_TARGET_INDEX] ?? AUTONOMY_REF_NONE;
  const targetGeneration = lanes[base + L_TARGET_GENERATION] ?? AUTONOMY_REF_NONE;
  const targetCell = lanes[base + L_TARGET_CELL] ?? AUTONOMY_REF_NONE;
  if (
    !validateStoredScalarReferences(
      offerId,
      jobId,
      pendingJobId,
      targetIndex,
      targetGeneration,
      targetCell,
    )
  )
    return false;
  if (!validateStoredBasis(lanes, base + L_BASIS)) return false;
  if (
    !isValidJobPolicyBinding(
      jobId,
      lanes[base + L_INTERRUPTION_POLICY] ?? AUTONOMY_INTERRUPTION_POLICY_NONE,
      lanes[base + L_BASIS + 13] ?? 0,
    )
  )
    return false;
  if (!validateStoredContext(lanes, base)) return false;
  const hasTarget = targetIndex !== AUTONOMY_REF_NONE || targetCell !== AUTONOMY_REF_NONE;
  return validateStoredStateSemantics(
    state,
    offerId,
    jobId,
    pendingJobId,
    hasTarget,
    routeCount,
    claimCount,
  );
}

function validateStoredBasis(lanes: Uint32Array, base: number): boolean {
  for (let index = 0; index < 14; index += 1)
    if (!isUint32(lanes[base + index] ?? -1)) return false;
  return true;
}

function validateStoredScalarReferences(
  offerId: number,
  jobId: number,
  pendingJobId: number,
  targetIndex: number,
  targetGeneration: number,
  targetCell: number,
): boolean {
  return (
    isOptionalScalar(offerId) &&
    isOptionalScalar(jobId) &&
    isOptionalScalar(pendingJobId) &&
    isOptionalEntityRef(targetIndex, targetGeneration) &&
    isOptionalScalar(targetCell)
  );
}

function validateStoredContext(lanes: Uint32Array, base: number): boolean {
  return (
    isOptionalBounded(lanes[base + L_NEED_LANE] ?? AUTONOMY_REF_NONE, 5) &&
    (lanes[base + L_NEED_VALUE] ?? 0) <= 1_000 &&
    isOptionalBounded(lanes[base + L_ABILITY] ?? AUTONOMY_REF_NONE, 6) &&
    isOptionalBounded(lanes[base + L_SCHEDULE] ?? AUTONOMY_REF_NONE, 4)
  );
}

function validateStoredStateSemantics(
  state: number,
  offerId: number,
  jobId: number,
  pendingJobId: number,
  hasTarget: boolean,
  routeCount: number,
  claimCount: number,
): boolean {
  if (state !== AUTONOMY_STATE_IDLE && !hasTarget) return false;
  if (state === AUTONOMY_STATE_IDLE)
    return (
      offerId === AUTONOMY_REF_NONE &&
      jobId === AUTONOMY_REF_NONE &&
      pendingJobId === AUTONOMY_REF_NONE &&
      !hasTarget &&
      routeCount === 0 &&
      claimCount === 0
    );
  if (state === AUTONOMY_STATE_CLAIMING)
    return (
      offerId !== AUTONOMY_REF_NONE &&
      jobId === AUTONOMY_REF_NONE &&
      hasPairedRouteClaims(routeCount, claimCount) &&
      hasValidPendingJobBinding(pendingJobId, routeCount)
    );
  if (state === AUTONOMY_STATE_MOVING)
    return (
      jobId !== AUTONOMY_REF_NONE &&
      pendingJobId === AUTONOMY_REF_NONE &&
      routeCount > 0 &&
      claimCount > 0
    );
  if (state === AUTONOMY_STATE_WORKING)
    return jobId !== AUTONOMY_REF_NONE && pendingJobId === AUTONOMY_REF_NONE && claimCount > 0;
  if (state === AUTONOMY_STATE_BLOCKED)
    return hasValidBlockedJobBinding(jobId, pendingJobId, routeCount, claimCount);
  if (state === AUTONOMY_STATE_COMPLETED)
    return (
      jobId !== AUTONOMY_REF_NONE &&
      pendingJobId === AUTONOMY_REF_NONE &&
      routeCount === 0 &&
      claimCount === 0
    );
  if (state === AUTONOMY_STATE_FAILED || state === AUTONOMY_STATE_INTERRUPTED)
    return (
      (jobId !== AUTONOMY_REF_NONE || offerId !== AUTONOMY_REF_NONE) &&
      pendingJobId === AUTONOMY_REF_NONE &&
      routeCount === 0 &&
      claimCount === 0
    );
  return true;
}

function validateStoredTerminal(
  snapshot: ResidentAutonomySnapshot,
  residentIndex: number,
  base: number,
  present: number,
): boolean {
  const terminalStateValue = snapshot.lanes[base + L_TERMINAL_STATE] ?? 0;
  if (!isAutonomyState(terminalStateValue)) return false;
  const terminalState = terminalStateValue;
  const offerId = snapshot.lanes[base + L_TERMINAL_OFFER] ?? AUTONOMY_REF_NONE;
  const jobId = snapshot.lanes[base + L_TERMINAL_JOB] ?? AUTONOMY_REF_NONE;
  const interruptionPolicyCode =
    snapshot.lanes[base + L_TERMINAL_INTERRUPTION_POLICY] ?? AUTONOMY_INTERRUPTION_POLICY_NONE;
  const jobVersion = snapshot.lanes[base + L_TERMINAL_JOB_VERSION] ?? 0;
  const targetIndex = snapshot.lanes[base + L_TERMINAL_TARGET_INDEX] ?? AUTONOMY_REF_NONE;
  const targetGeneration = snapshot.lanes[base + L_TERMINAL_TARGET_GENERATION] ?? AUTONOMY_REF_NONE;
  const targetCell = snapshot.lanes[base + L_TERMINAL_TARGET_CELL] ?? AUTONOMY_REF_NONE;
  if (
    !validateStoredScalarReferences(
      offerId,
      jobId,
      AUTONOMY_REF_NONE,
      targetIndex,
      targetGeneration,
      targetCell,
    )
  )
    return false;
  if (!validateStoredReason(snapshot, residentIndex, base + L_TERMINAL_REASON, P_TERMINAL))
    return false;
  if (!validateStoredTerminalReasonSemantics(snapshot, residentIndex, base, terminalState, present))
    return false;
  const terminalTick = snapshot.ticks[residentIndex * TICK_LANE_COUNT + T_TERMINAL] ?? -1;
  if (present === 1)
    return validatePresentTerminal(
      terminalState,
      offerId,
      jobId,
      interruptionPolicyCode,
      jobVersion,
      targetIndex,
      targetCell,
      terminalTick,
    );
  return validateEmptyTerminal(
    terminalState,
    offerId,
    jobId,
    interruptionPolicyCode,
    jobVersion,
    targetIndex,
    targetCell,
    terminalTick,
  );
}

function validatePresentTerminal(
  state: AutonomyState,
  offerId: number,
  jobId: number,
  interruptionPolicyCode: number,
  jobVersion: number,
  targetIndex: number,
  targetCell: number,
  tick: number,
): boolean {
  const hasTarget = targetIndex !== AUTONOMY_REF_NONE || targetCell !== AUTONOMY_REF_NONE;
  const hasEventRef = jobId !== AUTONOMY_REF_NONE || offerId !== AUTONOMY_REF_NONE;
  return (
    isTerminalState(state) &&
    hasTarget &&
    hasEventRef &&
    isValidJobPolicyBinding(jobId, interruptionPolicyCode, jobVersion) &&
    (state !== AUTONOMY_STATE_COMPLETED || jobId !== AUTONOMY_REF_NONE) &&
    isSafeTick(tick)
  );
}

function validateEmptyTerminal(
  state: AutonomyState,
  offerId: number,
  jobId: number,
  interruptionPolicyCode: number,
  jobVersion: number,
  targetIndex: number,
  targetCell: number,
  tick: number,
): boolean {
  return (
    state === AUTONOMY_STATE_IDLE &&
    offerId === AUTONOMY_REF_NONE &&
    jobId === AUTONOMY_REF_NONE &&
    interruptionPolicyCode === AUTONOMY_INTERRUPTION_POLICY_NONE &&
    jobVersion === 0 &&
    targetIndex === AUTONOMY_REF_NONE &&
    targetCell === AUTONOMY_REF_NONE &&
    tick === 0
  );
}

function validateCurrentTerminalBinding(
  snapshot: ResidentAutonomySnapshot,
  residentIndex: number,
  base: number,
  state: number,
  terminalPresent: number,
): boolean {
  if (!isAutonomyState(state) || !isTerminalState(state)) return true;
  if (terminalPresent !== 1 || !sameTerminalExecutionLanes(snapshot.lanes, base)) return false;
  const tickBase = residentIndex * TICK_LANE_COUNT;
  if (
    (snapshot.ticks[tickBase + T_STATE_ENTERED] ?? 0) !==
    (snapshot.ticks[tickBase + T_TERMINAL] ?? 0)
  )
    return false;
  if (!sameReasonLanes(snapshot.lanes, base + L_REASON, base + L_TERMINAL_REASON)) return false;
  const parameterBase = residentIndex * PARAMETER_LANE_COUNT;
  for (let index = 0; index < 6; index += 1)
    if (
      (snapshot.reasonParameters[parameterBase + P_CURRENT + index] ?? 0) !==
      (snapshot.reasonParameters[parameterBase + P_TERMINAL + index] ?? 0)
    )
      return false;
  return true;
}

function sameTerminalExecutionLanes(lanes: Uint32Array, base: number): boolean {
  return (
    lanes[base + L_STATE] === lanes[base + L_TERMINAL_STATE] &&
    lanes[base + L_OFFER] === lanes[base + L_TERMINAL_OFFER] &&
    lanes[base + L_JOB] === lanes[base + L_TERMINAL_JOB] &&
    lanes[base + L_INTERRUPTION_POLICY] === lanes[base + L_TERMINAL_INTERRUPTION_POLICY] &&
    lanes[base + L_BASIS + 13] === lanes[base + L_TERMINAL_JOB_VERSION] &&
    lanes[base + L_TARGET_INDEX] === lanes[base + L_TERMINAL_TARGET_INDEX] &&
    lanes[base + L_TARGET_GENERATION] === lanes[base + L_TERMINAL_TARGET_GENERATION] &&
    lanes[base + L_TARGET_CELL] === lanes[base + L_TERMINAL_TARGET_CELL]
  );
}

function sameReasonLanes(lanes: Uint32Array, currentBase: number, terminalBase: number): boolean {
  for (let index = 0; index < 9; index += 1)
    if (lanes[currentBase + index] !== lanes[terminalBase + index]) return false;
  return true;
}

function validateInactiveRow(snapshot: ResidentAutonomySnapshot, residentIndex: number): boolean {
  const base = residentIndex * LANE_COUNT;
  for (let lane = 0; lane < LANE_COUNT; lane += 1)
    if ((snapshot.lanes[base + lane] ?? 0) !== 0) return false;
  const parameterBase = residentIndex * PARAMETER_LANE_COUNT;
  for (let lane = 0; lane < PARAMETER_LANE_COUNT; lane += 1)
    if ((snapshot.reasonParameters[parameterBase + lane] ?? 0) !== 0) return false;
  const tickBase = residentIndex * TICK_LANE_COUNT;
  for (let lane = 0; lane < TICK_LANE_COUNT; lane += 1)
    if ((snapshot.ticks[tickBase + lane] ?? 0) !== 0) return false;
  return validateStoredRouteClaims(snapshot, residentIndex, 0, 0);
}

function validateStoredRouteClaims(
  snapshot: ResidentAutonomySnapshot,
  residentIndex: number,
  routeCount: number,
  claimCount: number,
): boolean {
  const routeBase = residentIndex * AUTONOMY_MAX_ROUTE_CELLS;
  for (let index = 0; index < AUTONOMY_MAX_ROUTE_CELLS; index += 1) {
    const value = snapshot.routeCells[routeBase + index] ?? AUTONOMY_REF_NONE;
    if (
      (index < routeCount && !isStoredRef(value)) ||
      (index >= routeCount && value !== AUTONOMY_REF_NONE)
    )
      return false;
  }
  const claimBase = residentIndex * AUTONOMY_MAX_CLAIM_REFS;
  for (let index = 0; index < AUTONOMY_MAX_CLAIM_REFS; index += 1) {
    const value = snapshot.claimIds[claimBase + index] ?? AUTONOMY_REF_NONE;
    if (
      (index < claimCount && !isStoredRef(value)) ||
      (index >= claimCount && value !== AUTONOMY_REF_NONE)
    )
      return false;
  }
  return true;
}

function validateStoredReason(
  snapshot: ResidentAutonomySnapshot,
  residentIndex: number,
  base: number,
  parameterOffset: number,
): boolean {
  const parameterBase = residentIndex * PARAMETER_LANE_COUNT + parameterOffset;
  return isValidAutonomyReasonFields(
    snapshot.lanes[base + R_CODE] ?? 0,
    snapshot.lanes[base + R_SOURCE] ?? 0,
    snapshot.lanes[base + R_SUBJECT_INDEX] ?? AUTONOMY_REF_NONE,
    snapshot.lanes[base + R_SUBJECT_GENERATION] ?? AUTONOMY_REF_NONE,
    snapshot.lanes[base + R_TARGET_INDEX] ?? AUTONOMY_REF_NONE,
    snapshot.lanes[base + R_TARGET_GENERATION] ?? AUTONOMY_REF_NONE,
    snapshot.lanes[base + R_PARAMETER_COUNT] ?? 0,
    snapshot.reasonParameters[parameterBase] ?? 0,
    snapshot.reasonParameters[parameterBase + 1] ?? 0,
    snapshot.reasonParameters[parameterBase + 2] ?? 0,
    snapshot.reasonParameters[parameterBase + 3] ?? 0,
    snapshot.reasonParameters[parameterBase + 4] ?? 0,
    snapshot.reasonParameters[parameterBase + 5] ?? 0,
    snapshot.lanes[base + R_OWNER_BASIS] ?? 0,
    snapshot.lanes[base + R_SUGGESTION] ?? 0,
  );
}

function validateStoredCurrentReasonSemantics(
  snapshot: ResidentAutonomySnapshot,
  residentIndex: number,
  base: number,
  state: AutonomyState,
): boolean {
  const reasonBase = base + L_REASON;
  const codeValue = snapshot.lanes[reasonBase + R_CODE] ?? AUTONOMY_REASON_NONE;
  if (!isAutonomyReasonCode(codeValue) || !isReasonAllowedForState(state, codeValue)) return false;
  if (codeValue === AUTONOMY_REASON_NONE) return state === AUTONOMY_STATE_COMPLETED;
  if (!storedReasonSubjectMatches(snapshot.lanes, reasonBase, residentIndex, base)) return false;
  if (
    !storedReasonTargetMatches(
      snapshot.lanes,
      reasonBase,
      base + L_TARGET_INDEX,
      base + L_TARGET_GENERATION,
    )
  )
    return false;
  return (
    (snapshot.lanes[reasonBase + R_OWNER_BASIS] ?? 0) ===
    readStoredReasonOwnerBasis(codeValue, snapshot.lanes, base + L_BASIS)
  );
}

function validateStoredTerminalReasonSemantics(
  snapshot: ResidentAutonomySnapshot,
  residentIndex: number,
  base: number,
  state: AutonomyState,
  present: number,
): boolean {
  const reasonBase = base + L_TERMINAL_REASON;
  const codeValue = snapshot.lanes[reasonBase + R_CODE] ?? AUTONOMY_REASON_NONE;
  if (!isAutonomyReasonCode(codeValue)) return false;
  if (present === 0) return codeValue === AUTONOMY_REASON_NONE;
  if (!isReasonAllowedForState(state, codeValue)) return false;
  if (codeValue === AUTONOMY_REASON_NONE) return state === AUTONOMY_STATE_COMPLETED;
  if (!storedReasonSubjectMatches(snapshot.lanes, reasonBase, residentIndex, base)) return false;
  return storedReasonTargetMatches(
    snapshot.lanes,
    reasonBase,
    base + L_TERMINAL_TARGET_INDEX,
    base + L_TERMINAL_TARGET_GENERATION,
  );
}

function storedReasonSubjectMatches(
  lanes: Uint32Array,
  reasonBase: number,
  residentIndex: number,
  rowBase: number,
): boolean {
  return (
    lanes[reasonBase + R_SUBJECT_INDEX] === residentIndex &&
    lanes[reasonBase + R_SUBJECT_GENERATION] === lanes[rowBase + L_GENERATION]
  );
}

function storedReasonTargetMatches(
  lanes: Uint32Array,
  reasonBase: number,
  targetIndexLane: number,
  targetGenerationLane: number,
): boolean {
  const reasonTarget = lanes[reasonBase + R_TARGET_INDEX] ?? AUTONOMY_REASON_REF_NONE;
  if (reasonTarget === AUTONOMY_REASON_REF_NONE)
    return (
      (lanes[reasonBase + R_TARGET_GENERATION] ?? AUTONOMY_REASON_REF_NONE) ===
      AUTONOMY_REASON_REF_NONE
    );
  return (
    reasonTarget === (lanes[targetIndexLane] ?? AUTONOMY_REF_NONE) &&
    (lanes[reasonBase + R_TARGET_GENERATION] ?? AUTONOMY_REASON_REF_NONE) ===
      (lanes[targetGenerationLane] ?? AUTONOMY_REASON_REF_NONE)
  );
}

function readStoredReasonOwnerBasis(
  code: AutonomyReasonCode,
  lanes: Uint32Array,
  basisBase: number,
): number {
  if (code === AUTONOMY_REASON_IDLE_OFF_SHIFT) return lanes[basisBase + 1] ?? 0;
  if (code === AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER) return lanes[basisBase + 6] ?? 0;
  if (
    code === AUTONOMY_REASON_IDLE_RETRY_BACKOFF ||
    code === AUTONOMY_REASON_IDLE_DECISION_DEFERRED
  )
    return 0;
  if (
    code >= AUTONOMY_REASON_NEED_HUNGER_EMERGENCY &&
    code <= AUTONOMY_REASON_NEED_HEALTH_EMERGENCY
  )
    return lanes[basisBase] ?? 0;
  if (
    code >= AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED &&
    code <= AUTONOMY_REASON_CAPABILITY_ALLOWED
  )
    return lanes[basisBase + 2] ?? 0;
  if (code >= AUTONOMY_REASON_OFFER_EMPTY_BUCKET && code <= AUTONOMY_REASON_OFFER_SELECTED)
    return lanes[basisBase + (code === AUTONOMY_REASON_OFFER_SELECTED ? 4 : 6)] ?? 0;
  if (code >= AUTONOMY_REASON_PATH_NO_ROUTE && code <= AUTONOMY_REASON_PATH_SELECTED)
    return lanes[basisBase + 7] ?? 0;
  if (code >= AUTONOMY_REASON_RESERVATION_CONFLICT && code <= AUTONOMY_REASON_RESERVATION_ACQUIRED)
    return lanes[basisBase + 12] ?? 0;
  if (code === AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED) return lanes[basisBase + 1] ?? 0;
  if (code === AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY) return lanes[basisBase] ?? 0;
  if (code === AUTONOMY_REASON_INTERRUPTED_SHIFT_END) return lanes[basisBase + 1] ?? 0;
  const jobVersion = lanes[basisBase + 13] ?? 0;
  return jobVersion > 0 ? jobVersion : (lanes[basisBase + 4] ?? 0);
}

function countActive(active: Uint8Array): number {
  let count = 0;
  for (const value of active) count += value;
  return count;
}

function isTerminalState(state: AutonomyState): boolean {
  return (
    state === AUTONOMY_STATE_COMPLETED ||
    state === AUTONOMY_STATE_FAILED ||
    state === AUTONOMY_STATE_INTERRUPTED
  );
}

function isAutonomyState(value: number): value is AutonomyState {
  return (
    Number.isInteger(value) && value >= AUTONOMY_STATE_IDLE && value <= AUTONOMY_STATE_INTERRUPTED
  );
}

function readState(value: number): AutonomyState {
  if (value === 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;
  if (value === 5) return 5;
  if (value === 6) return 6;
  if (value === 7) return 7;
  return 0;
}

function readInterruptionPolicyCode(value: number): AutonomyInterruptionPolicyCode {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return AUTONOMY_INTERRUPTION_POLICY_NONE;
}

function isValidJobPolicyBinding(
  jobId: number,
  interruptionPolicyCode: number,
  jobVersion: number,
): boolean {
  if (
    interruptionPolicyCode < AUTONOMY_INTERRUPTION_POLICY_NONE ||
    interruptionPolicyCode > 4 ||
    !Number.isInteger(interruptionPolicyCode)
  )
    return false;
  if (jobId === AUTONOMY_REF_NONE)
    return interruptionPolicyCode === AUTONOMY_INTERRUPTION_POLICY_NONE && jobVersion === 0;
  return interruptionPolicyCode !== AUTONOMY_INTERRUPTION_POLICY_NONE && jobVersion > 0;
}

function isValidJobPolicyContinuity(
  lanes: Uint32Array,
  base: number,
  input: AutonomyTransitionInput,
): boolean {
  const currentJobId = lanes[base + L_JOB] ?? AUTONOMY_REF_NONE;
  if (currentJobId === AUTONOMY_REF_NONE || input.jobId === AUTONOMY_REF_NONE) return true;
  return (
    input.jobId === currentJobId &&
    input.interruptionPolicyCode === (lanes[base + L_INTERRUPTION_POLICY] ?? 0) &&
    input.basis.jobVersion >= (lanes[base + L_BASIS + 13] ?? 0)
  );
}

function readReasonSource(value: number): AutonomyReasonSource {
  if (
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 7 ||
    value === 8 ||
    value === 9 ||
    value === 10
  )
    return value;
  return 0;
}

function readSuggestion(value: number): AutonomySuggestion {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return 0;
}

function isResidentIndex(value: number, capacity: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < capacity;
}

function isOptionalScalar(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= AUTONOMY_REF_NONE;
}

function isOptionalBounded(value: number, upperBound: number): boolean {
  return (
    value === AUTONOMY_REF_NONE || (Number.isInteger(value) && value >= 0 && value < upperBound)
  );
}

function hasPairedRouteClaims(routeCount: number, claimCount: number): boolean {
  return (routeCount === 0 && claimCount === 0) || (routeCount > 0 && claimCount > 0);
}

function hasValidPendingJobBinding(pendingJobId: number, routeCount: number): boolean {
  return routeCount === 0 ? pendingJobId === AUTONOMY_REF_NONE : isStoredRef(pendingJobId);
}

function hasValidBlockedJobBinding(
  jobId: number,
  pendingJobId: number,
  routeCount: number,
  claimCount: number,
): boolean {
  if (pendingJobId !== AUTONOMY_REF_NONE)
    return jobId === AUTONOMY_REF_NONE && routeCount > 0 && claimCount > 0;
  if (jobId !== AUTONOMY_REF_NONE) return true;
  return routeCount === 0 && claimCount === 0;
}

function isStoredRef(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < AUTONOMY_REF_NONE;
}

function isValidRetryTick(stateTick: number, retryTick: number): boolean {
  return isSafeTick(retryTick) && (retryTick === 0 || retryTick >= stateTick);
}
