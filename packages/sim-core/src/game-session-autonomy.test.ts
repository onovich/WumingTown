import { expect, it } from "vitest";

import {
  AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED,
  AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
  AUTONOMY_REASON_FAILED_INVARIANT,
  AUTONOMY_REASON_IDLE_RETRY_BACKOFF,
  AUTONOMY_REASON_IDLE_OFF_SHIFT,
  AUTONOMY_REASON_INTERRUPTED_DANGER,
  AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
  AUTONOMY_REASON_NONE,
  AUTONOMY_REASON_OFFER_EMPTY_BUCKET,
  AUTONOMY_REASON_OFFER_SELECTED,
  AUTONOMY_REASON_PATH_NO_ROUTE,
  AUTONOMY_REASON_REF_NONE,
  AUTONOMY_REASON_RESERVATION_ACQUIRED,
  AUTONOMY_REASON_RESERVATION_INSUFFICIENT_AMOUNT,
  AUTONOMY_REASON_SOURCE_CAPABILITY,
  AUTONOMY_REASON_SOURCE_IDLE,
  AUTONOMY_REASON_SOURCE_NEED,
  AUTONOMY_REASON_SOURCE_NONE,
  AUTONOMY_REASON_SOURCE_OFFER,
  AUTONOMY_REASON_SOURCE_PATH,
  AUTONOMY_REASON_SOURCE_RESERVATION,
  AUTONOMY_REASON_SOURCE_SCHEDULE,
  AUTONOMY_REASON_SOURCE_SYSTEM,
  AUTONOMY_SUGGESTION_INSPECT_CAPABILITY,
  AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
  AUTONOMY_SUGGESTION_INSPECT_RESOURCE,
  AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
  AUTONOMY_SUGGESTION_INSPECT_TARGET,
  AUTONOMY_SUGGESTION_NONE,
  isValidAutonomyReason,
  resetAutonomyReason,
  writeAutonomyReason,
  type AutonomyReasonCode,
  type AutonomyReasonOutput,
  type AutonomyReasonSource,
  type AutonomySuggestion,
} from "./game-session-autonomy-reasons";
import { ResidentAutonomyStore } from "./game-session-autonomy-store";
import { isLegalAutonomyTransition } from "./game-session-autonomy-store";
import {
  AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
  AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE,
  AUTONOMY_INTERRUPTION_POLICY_NONE,
  AUTONOMY_MAX_CLAIM_REFS,
  AUTONOMY_MAX_ROUTE_CELLS,
  AUTONOMY_REF_NONE,
  AUTONOMY_STATE_BLOCKED,
  AUTONOMY_STATE_CLAIMING,
  AUTONOMY_STATE_COMPLETED,
  AUTONOMY_STATE_FAILED,
  AUTONOMY_STATE_IDLE,
  AUTONOMY_STATE_INTERRUPTED,
  AUTONOMY_STATE_MOVING,
  AUTONOMY_STATE_WORKING,
  AUTONOMY_STORE_BASIS_INVALID,
  AUTONOMY_STORE_CLAIM_CAPACITY,
  AUTONOMY_STORE_ILLEGAL_TRANSITION,
  AUTONOMY_STORE_OK,
  AUTONOMY_STORE_REFERENCE_INVALID,
  AUTONOMY_STORE_REASON_INVALID,
  AUTONOMY_STORE_ROUTE_CAPACITY,
  AUTONOMY_STORE_SNAPSHOT_SHAPE,
  AUTONOMY_STORE_SNAPSHOT_STATE,
  AUTONOMY_STORE_SNAPSHOT_VERSION,
  AUTONOMY_STORE_TICK_INVALID,
  AUTONOMY_STORE_VERSION_EXHAUSTED,
  AutonomySnapshotLane,
  AutonomySnapshotReasonParameterLane,
  AutonomySnapshotTickLane,
  type AutonomyState,
  type AutonomyStoreCode,
  type AutonomyStoreOutput,
  type AutonomyTerminalOutput,
  type AutonomyTransitionInput,
  type AutonomyVersionBasis,
  type ResidentAutonomyReadOutput,
  type ResidentAutonomySnapshot,
} from "./game-session-autonomy-types";

interface ReasonCase {
  readonly code: AutonomyReasonCode;
  readonly source: AutonomyReasonSource;
  readonly suggestion: AutonomySuggestion;
}

it("validates bounded numeric structured reason families without prose", () => {
  const reason = createReason();
  const identity = reason;
  const cases: readonly ReasonCase[] = [
    {
      code: AUTONOMY_REASON_IDLE_OFF_SHIFT,
      source: AUTONOMY_REASON_SOURCE_IDLE,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    },
    {
      code: AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
      source: AUTONOMY_REASON_SOURCE_NEED,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESOURCE,
    },
    {
      code: AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
      source: AUTONOMY_REASON_SOURCE_CAPABILITY,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_CAPABILITY,
    },
    {
      code: AUTONOMY_REASON_OFFER_EMPTY_BUCKET,
      source: AUTONOMY_REASON_SOURCE_OFFER,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_TARGET,
    },
    {
      code: AUTONOMY_REASON_PATH_NO_ROUTE,
      source: AUTONOMY_REASON_SOURCE_PATH,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_TARGET,
    },
    {
      code: AUTONOMY_REASON_RESERVATION_INSUFFICIENT_AMOUNT,
      source: AUTONOMY_REASON_SOURCE_RESERVATION,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESOURCE,
    },
    {
      code: AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED,
      source: AUTONOMY_REASON_SOURCE_SCHEDULE,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    },
    {
      code: AUTONOMY_REASON_FAILED_INVARIANT,
      source: AUTONOMY_REASON_SOURCE_SYSTEM,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    },
    {
      code: AUTONOMY_REASON_INTERRUPTED_DANGER,
      source: AUTONOMY_REASON_SOURCE_SYSTEM,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    },
  ];

  for (const entry of cases) {
    writeAutonomyReason(
      reason,
      entry.code,
      entry.source,
      0,
      1,
      AUTONOMY_REASON_REF_NONE,
      AUTONOMY_REASON_REF_NONE,
      6,
      0xffff_ffff,
      entry.suggestion,
      -0x8000_0000,
      0x7fff_ffff,
      -1,
      0,
      1,
      17,
    );
    expect(reason).toBe(identity);
    expect(isValidAutonomyReason(reason), `reason code ${String(entry.code)}`).toBe(true);
  }

  expect("message" in reason).toBe(false);
  expect("prose" in reason).toBe(false);
  expect("text" in reason).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_FAILED_INVARIANT,
    AUTONOMY_REASON_SOURCE_SYSTEM,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    7,
    1,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    1,
    2,
    3,
    4,
    5,
    6,
  );
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_IDLE_OFF_SHIFT,
    AUTONOMY_REASON_SOURCE_IDLE,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    2,
    1,
    AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    -2,
    3,
    99,
    99,
    99,
    99,
  );
  expect(reason.parameter2).toBe(0);
  reason.parameter5 = 1;
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_IDLE_OFF_SHIFT,
    AUTONOMY_REASON_SOURCE_NEED,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    1,
    AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
    AUTONOMY_REASON_SOURCE_NEED,
    AUTONOMY_REASON_REF_NONE,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    1,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
    AUTONOMY_REASON_SOURCE_NEED,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    1,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  Reflect.set(reason, "suggestion", 6);
  expect(isValidAutonomyReason(reason)).toBe(false);

  resetAutonomyReason(reason);
  expect(reason).toBe(identity);
  expect(reason).toEqual(createReason());
  expect(isValidAutonomyReason(reason)).toBe(true);
});

it("registers and reads one idle resident through caller-owned outputs", () => {
  const store = new ResidentAutonomyStore(2);
  const storeOutput = createStoreOutput();
  const storeOutputIdentity = storeOutput;
  store.registerResidentInto(0, 1, 0, storeOutput);

  expect(storeOutput).toBe(storeOutputIdentity);
  expect(storeOutput).toMatchObject({
    ok: true,
    code: AUTONOMY_STORE_OK,
    residentIndex: 0,
    residentGeneration: 1,
    nextState: AUTONOMY_STATE_IDLE,
    rowVersion: 1,
    storeVersion: 1,
  });

  const readOutput = createReadOutput();
  const readIdentity = readOutput;
  const basisIdentity = readOutput.basis;
  const reasonIdentity = readOutput.reason;
  const terminalIdentity = readOutput.terminal;
  const terminalReasonIdentity = readOutput.terminal.reason;
  const routeIdentity = readOutput.routeCells;
  const claimIdentity = readOutput.claimIds;
  readOutput.routeCells.fill(77);
  readOutput.claimIds.fill(88);

  store.readResidentInto(0, 1, readOutput);

  expect(readOutput).toBe(readIdentity);
  expect(readOutput.basis).toBe(basisIdentity);
  expect(readOutput.reason).toBe(reasonIdentity);
  expect(readOutput.terminal).toBe(terminalIdentity);
  expect(readOutput.terminal.reason).toBe(terminalReasonIdentity);
  expect(readOutput.routeCells).toBe(routeIdentity);
  expect(readOutput.claimIds).toBe(claimIdentity);
  expect(readOutput).toMatchObject({
    ok: true,
    code: AUTONOMY_STORE_OK,
    residentIndex: 0,
    residentGeneration: 1,
    state: AUTONOMY_STATE_IDLE,
    stateEnteredTick: 0,
    retryTick: 0,
    rowVersion: 1,
    storeVersion: 1,
    routeCellCount: 0,
    routeCursor: 0,
    claimCount: 0,
  });
  expect(readOutput.reason.code).toBe(AUTONOMY_REASON_IDLE_RETRY_BACKOFF);
  expect(readOutput.terminal.present).toBe(false);
  expect(readOutput.terminal.reason.code).toBe(AUTONOMY_REASON_NONE);
  expect(Array.from(readOutput.routeCells)).toEqual(
    Array.from({ length: AUTONOMY_MAX_ROUTE_CELLS }, () => AUTONOMY_REF_NONE),
  );
  expect(Array.from(readOutput.claimIds)).toEqual(
    Array.from({ length: AUTONOMY_MAX_CLAIM_REFS }, () => AUTONOMY_REF_NONE),
  );
});

it("enforces the exact eight-state transition table without prevalidation mutation", () => {
  const states: readonly AutonomyState[] = [
    AUTONOMY_STATE_IDLE,
    AUTONOMY_STATE_CLAIMING,
    AUTONOMY_STATE_MOVING,
    AUTONOMY_STATE_WORKING,
    AUTONOMY_STATE_BLOCKED,
    AUTONOMY_STATE_COMPLETED,
    AUTONOMY_STATE_FAILED,
    AUTONOMY_STATE_INTERRUPTED,
  ];
  const legalNext: readonly (readonly AutonomyState[])[] = [
    [AUTONOMY_STATE_CLAIMING, AUTONOMY_STATE_INTERRUPTED],
    [
      AUTONOMY_STATE_MOVING,
      AUTONOMY_STATE_WORKING,
      AUTONOMY_STATE_BLOCKED,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [
      AUTONOMY_STATE_WORKING,
      AUTONOMY_STATE_BLOCKED,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [
      AUTONOMY_STATE_COMPLETED,
      AUTONOMY_STATE_BLOCKED,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [
      AUTONOMY_STATE_CLAIMING,
      AUTONOMY_STATE_MOVING,
      AUTONOMY_STATE_WORKING,
      AUTONOMY_STATE_IDLE,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [AUTONOMY_STATE_IDLE],
    [AUTONOMY_STATE_IDLE],
    [AUTONOMY_STATE_IDLE, AUTONOMY_STATE_CLAIMING],
  ];
  for (let fromIndex = 0; fromIndex < states.length; fromIndex += 1) {
    const from = states[fromIndex];
    const allowed = legalNext[fromIndex];
    if (from === undefined || allowed === undefined) throw new Error("missing transition fixture");
    let illegalCount = 0;
    for (const to of states) {
      const expected = allowed.includes(to);
      expect(isLegalAutonomyTransition(from, to), `${String(from)} -> ${String(to)}`).toBe(
        expected,
      );
      if (!expected) illegalCount += 1;
    }
    expect(illegalCount).toBeGreaterThan(0);
  }

  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const beforeValidation = store.createSnapshot();
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: true, rowVersion: 1, storeVersion: 1 });
  expect(store.createSnapshot()).toEqual(beforeValidation);

  store.transitionInto(input, output);
  expect(output).toMatchObject({
    ok: true,
    previousState: AUTONOMY_STATE_IDLE,
    nextState: AUTONOMY_STATE_CLAIMING,
    rowVersion: 2,
    storeVersion: 2,
  });
  const afterClaiming = store.createSnapshot();
  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_COMPLETED;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_ILLEGAL_TRANSITION });
  expect(store.createSnapshot()).toEqual(afterClaiming);
});

it("copies bounded authoritative route and claims and rejects every capacity overflow atomically", () => {
  const store = new ResidentAutonomyStore(2);
  const transitionOutput = createStoreOutput();
  const transitionIdentity = transitionOutput;
  store.registerResidentInto(0, 1, 0, transitionOutput);
  const input = createClaimingInput();
  store.transitionInto(input, transitionOutput);

  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_MOVING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.routeCellCount = 3;
  input.routeCursor = 1;
  input.routeCells.fill(77);
  input.routeCells[0] = 4;
  input.routeCells[1] = 5;
  input.routeCells[2] = 6;
  input.claimCount = 2;
  input.claimIds.fill(88);
  input.claimIds[0] = 21;
  input.claimIds[1] = 22;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    0,
    1,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  const routeIdentity = input.routeCells;
  const claimIdentity = input.claimIds;
  store.transitionInto(input, transitionOutput);
  expect(transitionOutput).toBe(transitionIdentity);
  expect(input.routeCells).toBe(routeIdentity);
  expect(input.claimIds).toBe(claimIdentity);
  expect(transitionOutput).toMatchObject({ ok: true, rowVersion: 3, storeVersion: 3 });

  const readOutput = createReadOutput();
  const readIdentity = readOutput;
  const readRouteIdentity = readOutput.routeCells;
  const readClaimIdentity = readOutput.claimIds;
  store.readResidentInto(0, 1, readOutput);
  expect(readOutput).toBe(readIdentity);
  expect(readOutput.routeCells).toBe(readRouteIdentity);
  expect(readOutput.claimIds).toBe(readClaimIdentity);
  expect(readOutput).toMatchObject({
    ok: true,
    state: AUTONOMY_STATE_MOVING,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    routeCellCount: 3,
    routeCursor: 1,
    claimCount: 2,
  });
  expect(Array.from(readOutput.routeCells.slice(0, 3))).toEqual([4, 5, 6]);
  expect(Array.from(readOutput.routeCells.slice(3))).toEqual(
    Array.from({ length: AUTONOMY_MAX_ROUTE_CELLS - 3 }, () => AUTONOMY_REF_NONE),
  );
  expect(Array.from(readOutput.claimIds.slice(0, 2))).toEqual([21, 22]);
  expect(Array.from(readOutput.claimIds.slice(2))).toEqual(
    Array.from({ length: AUTONOMY_MAX_CLAIM_REFS - 2 }, () => AUTONOMY_REF_NONE),
  );

  const stable = store.createSnapshot();
  const shortRouteRead = createReadOutput(AUTONOMY_MAX_ROUTE_CELLS - 1);
  store.readResidentInto(0, 1, shortRouteRead);
  expect(shortRouteRead).toMatchObject({ ok: false, code: AUTONOMY_STORE_ROUTE_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
  const shortClaimRead = createReadOutput(AUTONOMY_MAX_ROUTE_CELLS, AUTONOMY_MAX_CLAIM_REFS - 1);
  store.readResidentInto(0, 1, shortClaimRead);
  expect(shortClaimRead).toMatchObject({ ok: false, code: AUTONOMY_STORE_CLAIM_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);

  input.expectedState = AUTONOMY_STATE_MOVING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.routeCellCount = AUTONOMY_MAX_ROUTE_CELLS + 1;
  store.validateTransitionInto(input, transitionOutput);
  expect(transitionOutput).toMatchObject({ ok: false, code: AUTONOMY_STORE_ROUTE_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
  input.routeCellCount = 3;
  input.routeCursor = 4;
  store.validateTransitionInto(input, transitionOutput);
  expect(transitionOutput).toMatchObject({ ok: false, code: AUTONOMY_STORE_ROUTE_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
  input.routeCursor = 1;
  input.claimCount = AUTONOMY_MAX_CLAIM_REFS + 1;
  store.validateTransitionInto(input, transitionOutput);
  expect(transitionOutput).toMatchObject({ ok: false, code: AUTONOMY_STORE_CLAIM_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
});

it("allows claiming to publish only acquired route and claim pairs before a job exists", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const idleSnapshot = store.createSnapshot();

  input.routeCellCount = 3;
  input.routeCursor = 0;
  input.routeCells[0] = 4;
  input.routeCells[1] = 5;
  input.routeCells[2] = 6;
  input.claimCount = 0;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(idleSnapshot);

  input.routeCellCount = 0;
  input.claimCount = 2;
  input.claimIds[0] = 21;
  input.claimIds[1] = 22;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(idleSnapshot);

  input.routeCellCount = 3;
  input.claimCount = 2;
  input.pendingJobId = 11;
  writeAcquiredReason(input);
  store.transitionInto(input, output);
  expect(output).toMatchObject({
    ok: true,
    nextState: AUTONOMY_STATE_CLAIMING,
    rowVersion: 2,
    storeVersion: 2,
  });
  const readOutput = createReadOutput();
  store.readResidentInto(0, 1, readOutput);
  expect(readOutput).toMatchObject({
    ok: true,
    state: AUTONOMY_STATE_CLAIMING,
    offerId: 3,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: 11,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    routeCellCount: 3,
    routeCursor: 0,
    claimCount: 2,
  });
  expect(Array.from(readOutput.routeCells.slice(0, 3))).toEqual([4, 5, 6]);
  expect(Array.from(readOutput.claimIds.slice(0, 2))).toEqual([21, 22]);

  const snapshot = store.createSnapshot();
  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(snapshot, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(snapshot);
});

it("binds interruption policy and job version without partially mutating invalid transitions", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const idle = store.createSnapshot();

  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(idle);
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_NONE;
  input.basis.jobVersion = 1;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(idle);

  input.basis.jobVersion = 0;
  store.transitionInto(input, output);
  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_MOVING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.routeCellCount = 1;
  input.routeCells[0] = 7;
  input.claimCount = 1;
  input.claimIds[0] = 21;
  writeAcquiredReason(input);
  const claiming = store.createSnapshot();
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);
  input.basis.jobVersion = 17;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_MOVING });
  const moving = store.createSnapshot();
  input.expectedState = AUTONOMY_STATE_MOVING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.stateEnteredTick = 3;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE;
  input.basis.jobVersion = 18;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 16;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
});

it("rejects raw states, tick rollback, reason-state mismatch and uncleared terminal claims", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const idle = store.createSnapshot();
  Reflect.set(input, "nextState", 33);
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_ILLEGAL_TRANSITION });
  expect(store.createSnapshot()).toEqual(idle);

  input.nextState = AUTONOMY_STATE_CLAIMING;
  input.stateEnteredTick = 2;
  store.transitionInto(input, output);
  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_MOVING;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.routeCellCount = 1;
  input.routeCells[0] = 7;
  input.claimCount = 1;
  input.claimIds[0] = 21;
  writeAcquiredReason(input);
  const claiming = store.createSnapshot();
  input.stateEnteredTick = 1;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_TICK_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);

  input.stateEnteredTick = 3;
  writeFailedInvariantReason(input);
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REASON_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);
  writeAcquiredReason(input);
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_MOVING });

  input.expectedState = AUTONOMY_STATE_MOVING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_FAILED;
  input.stateEnteredTick = 4;
  input.routeCellCount = 0;
  input.claimCount = 0;
  resetAutonomyReason(input.reason);
  const moving = store.createSnapshot();
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REASON_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
  writeFailedInvariantReason(input);
  input.routeCellCount = 1;
  input.claimCount = 1;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
  input.routeCellCount = 0;
  input.claimCount = 0;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_FAILED });
  const read = createReadOutput();
  store.readResidentInto(0, 1, read);
  expect(read).toMatchObject({ routeCellCount: 0, claimCount: 0 });
  expect(read.terminal).toMatchObject({
    present: true,
    state: AUTONOMY_STATE_FAILED,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    jobVersion: 17,
  });
});

it("retains a completed terminal across idle and roundtrips every snapshot lane atomically", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const initialIdleSnapshot = store.createSnapshot();
  const input = createClaimingInput();
  store.transitionInto(input, output);

  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.claimCount = 2;
  input.claimIds[0] = 21;
  input.claimIds[1] = 22;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    0,
    1,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    1,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    2,
    0,
    0,
    0,
    0,
    0,
  );
  store.transitionInto(input, output);

  input.expectedState = AUTONOMY_STATE_WORKING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_COMPLETED;
  input.stateEnteredTick = 3;
  input.routeCellCount = 0;
  input.routeCursor = 0;
  resetAutonomyReason(input.reason);
  const workingWithClaims = store.createSnapshot();
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(workingWithClaims);
  input.claimCount = 0;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_COMPLETED, rowVersion: 4 });

  const terminalRead = createReadOutput();
  store.readResidentInto(0, 1, terminalRead);
  expect(terminalRead).toMatchObject({
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    basis: { jobVersion: 17 },
  });
  expect(terminalRead.terminal).toMatchObject({
    present: true,
    state: AUTONOMY_STATE_COMPLETED,
    tick: 3,
    offerId: 3,
    jobId: 11,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    jobVersion: 17,
    targetEntityIndex: 5,
    targetEntityGeneration: 2,
    targetCellIndex: 7,
  });
  expect(terminalRead.terminal.reason.code).toBe(AUTONOMY_REASON_NONE);
  const completedSnapshot = store.createSnapshot();
  const completedGuard = new ResidentAutonomyStore(2);
  const badCompletedPolicy = cloneSnapshot(completedSnapshot);
  badCompletedPolicy.lanes[AutonomySnapshotLane.interruptionPolicyCode] =
    AUTONOMY_INTERRUPTION_POLICY_NONE;
  expectAtomicRestoreFailure(completedGuard, badCompletedPolicy, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badCompletedJobVersion = cloneSnapshot(completedSnapshot);
  badCompletedJobVersion.lanes[AutonomySnapshotLane.jobVersion] = 0;
  expectAtomicRestoreFailure(completedGuard, badCompletedJobVersion, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badMissingTerminal = cloneSnapshot(completedSnapshot);
  for (
    let lane = AutonomySnapshotLane.terminalPresent;
    lane <= AutonomySnapshotLane.terminalReasonSuggestion;
    lane += 1
  )
    badMissingTerminal.lanes[lane] = initialIdleSnapshot.lanes[lane] ?? 0;
  badMissingTerminal.lanes[AutonomySnapshotLane.terminalInterruptionPolicyCode] =
    initialIdleSnapshot.lanes[AutonomySnapshotLane.terminalInterruptionPolicyCode] ?? 0;
  badMissingTerminal.lanes[AutonomySnapshotLane.terminalJobVersion] =
    initialIdleSnapshot.lanes[AutonomySnapshotLane.terminalJobVersion] ?? 0;
  for (
    let lane = AutonomySnapshotReasonParameterLane.terminal0;
    lane <= AutonomySnapshotReasonParameterLane.terminal5;
    lane += 1
  )
    badMissingTerminal.reasonParameters[lane] = initialIdleSnapshot.reasonParameters[lane] ?? 0;
  badMissingTerminal.ticks[AutonomySnapshotTickLane.terminal] =
    initialIdleSnapshot.ticks[AutonomySnapshotTickLane.terminal] ?? 0;
  expectAtomicRestoreFailure(completedGuard, badMissingTerminal, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badTerminalTick = cloneSnapshot(completedSnapshot);
  badTerminalTick.ticks[AutonomySnapshotTickLane.terminal] = 2;
  expectAtomicRestoreFailure(completedGuard, badTerminalTick, AUTONOMY_STORE_SNAPSHOT_STATE);

  input.expectedState = AUTONOMY_STATE_COMPLETED;
  input.expectedRowVersion = 4;
  input.nextState = AUTONOMY_STATE_IDLE;
  input.stateEnteredTick = 4;
  input.retryTick = 5;
  input.offerId = AUTONOMY_REF_NONE;
  input.jobId = AUTONOMY_REF_NONE;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_NONE;
  input.basis.jobVersion = 0;
  input.targetEntityIndex = AUTONOMY_REF_NONE;
  input.targetEntityGeneration = AUTONOMY_REF_NONE;
  input.targetCellIndex = AUTONOMY_REF_NONE;
  input.claimCount = 0;
  input.needLane = AUTONOMY_REF_NONE;
  input.ability = AUTONOMY_REF_NONE;
  input.scheduleCode = AUTONOMY_REF_NONE;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_IDLE_RETRY_BACKOFF,
    AUTONOMY_REASON_SOURCE_IDLE,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    1,
    0,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    5,
    0,
    0,
    0,
    0,
    0,
  );
  store.transitionInto(input, output);

  const idleRead = createReadOutput();
  store.readResidentInto(0, 1, idleRead);
  expect(idleRead).toMatchObject({
    ok: true,
    state: AUTONOMY_STATE_IDLE,
    offerId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    basis: { jobVersion: 0 },
    targetEntityIndex: AUTONOMY_REF_NONE,
    targetEntityGeneration: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    routeCellCount: 0,
    claimCount: 0,
  });
  expect(idleRead.terminal).toEqual(terminalRead.terminal);
  expect(Array.from(idleRead.routeCells)).toEqual(
    Array.from({ length: AUTONOMY_MAX_ROUTE_CELLS }, () => AUTONOMY_REF_NONE),
  );
  expect(Array.from(idleRead.claimIds)).toEqual(
    Array.from({ length: AUTONOMY_MAX_CLAIM_REFS }, () => AUTONOMY_REF_NONE),
  );

  const snapshot = store.createSnapshot();
  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(snapshot, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(snapshot);
  const restoredRead = createReadOutput();
  restored.readResidentInto(0, 1, restoredRead);
  expect(restoredRead).toEqual(idleRead);

  const guard = new ResidentAutonomyStore(2);
  guard.registerResidentInto(1, 2, 8, output);
  const badVersion = cloneSnapshot(snapshot);
  Reflect.set(badVersion, "snapshotVersion", 2);
  expectAtomicRestoreFailure(guard, badVersion, AUTONOMY_STORE_SNAPSHOT_VERSION);
  const badShape = cloneSnapshot(snapshot);
  Reflect.set(badShape, "active", new Uint8Array(1));
  expectAtomicRestoreFailure(guard, badShape, AUTONOMY_STORE_SNAPSHOT_SHAPE);
  const wrongLaneType = cloneSnapshot(snapshot);
  Reflect.set(wrongLaneType, "lanes", new Float64Array(wrongLaneType.lanes));
  expectAtomicRestoreFailure(guard, wrongLaneType, AUTONOMY_STORE_SNAPSHOT_SHAPE);
  const throwingLaneGetter = cloneSnapshot(snapshot);
  Object.defineProperty(throwingLaneGetter, "lanes", {
    configurable: true,
    get(): Uint32Array {
      throw new Error("malicious lanes getter");
    },
  });
  expectAtomicRestoreFailure(guard, throwingLaneGetter, AUTONOMY_STORE_SNAPSHOT_SHAPE);
  const badState = cloneSnapshot(snapshot);
  badState.lanes[AutonomySnapshotLane.state] = 99;
  expectAtomicRestoreFailure(guard, badState, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badRawTerminalState = cloneSnapshot(snapshot);
  badRawTerminalState.lanes[AutonomySnapshotLane.terminalState] = 99;
  expectAtomicRestoreFailure(guard, badRawTerminalState, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badReason = cloneSnapshot(snapshot);
  badReason.lanes[AutonomySnapshotLane.reasonSource] = AUTONOMY_REASON_SOURCE_NEED;
  expectAtomicRestoreFailure(guard, badReason, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badRouteTail = cloneSnapshot(snapshot);
  badRouteTail.routeCells[0] = 9;
  expectAtomicRestoreFailure(guard, badRouteTail, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badTerminalJob = cloneSnapshot(snapshot);
  badTerminalJob.lanes[AutonomySnapshotLane.terminalJobId] = AUTONOMY_REF_NONE;
  expectAtomicRestoreFailure(guard, badTerminalJob, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badTerminalChronology = cloneSnapshot(snapshot);
  badTerminalChronology.ticks[AutonomySnapshotTickLane.terminal] = 6;
  expectAtomicRestoreFailure(guard, badTerminalChronology, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdleClaims = cloneSnapshot(snapshot);
  badIdleClaims.lanes[AutonomySnapshotLane.claimCount] = 1;
  badIdleClaims.claimIds[0] = 21;
  expectAtomicRestoreFailure(guard, badIdleClaims, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdlePendingJob = cloneSnapshot(snapshot);
  badIdlePendingJob.lanes[AutonomySnapshotLane.pendingJobId] = 11;
  expectAtomicRestoreFailure(guard, badIdlePendingJob, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdlePolicy = cloneSnapshot(snapshot);
  badIdlePolicy.lanes[AutonomySnapshotLane.interruptionPolicyCode] =
    AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  expectAtomicRestoreFailure(guard, badIdlePolicy, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdleJobVersion = cloneSnapshot(snapshot);
  badIdleJobVersion.lanes[AutonomySnapshotLane.jobVersion] = 1;
  expectAtomicRestoreFailure(guard, badIdleJobVersion, AUTONOMY_STORE_SNAPSHOT_STATE);
});

it("restores exhausted row and store versions but rejects the next transition without mutation", () => {
  const source = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  source.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  source.transitionInto(input, output);
  const exhausted = source.createSnapshot();
  exhausted.lanes[AutonomySnapshotLane.rowVersion] = 0xffff_ffff;
  Reflect.set(exhausted, "storeVersion", 0xffff_ffff);

  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(exhausted, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(exhausted);

  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 0xffff_ffff;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.claimCount = 1;
  input.claimIds[0] = 21;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    0,
    1,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  const before = restored.createSnapshot();
  restored.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_VERSION_EXHAUSTED });
  expect(restored.createSnapshot()).toEqual(before);
});

function createStoreOutput(): AutonomyStoreOutput {
  return {
    ok: false,
    code: AUTONOMY_STORE_OK,
    residentIndex: AUTONOMY_REF_NONE,
    residentGeneration: AUTONOMY_REF_NONE,
    previousState: AUTONOMY_STATE_IDLE,
    nextState: AUTONOMY_STATE_IDLE,
    rowVersion: 0,
    storeVersion: 0,
  };
}

function createReadOutput(
  routeCapacity = AUTONOMY_MAX_ROUTE_CELLS,
  claimCapacity = AUTONOMY_MAX_CLAIM_REFS,
): ResidentAutonomyReadOutput {
  return {
    ok: false,
    code: AUTONOMY_STORE_OK,
    residentIndex: AUTONOMY_REF_NONE,
    residentGeneration: AUTONOMY_REF_NONE,
    state: AUTONOMY_STATE_IDLE,
    stateEnteredTick: 0,
    retryTick: 0,
    offerId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    targetEntityIndex: AUTONOMY_REF_NONE,
    targetEntityGeneration: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    routeCellCount: 0,
    routeCursor: 0,
    routeCells: new Uint32Array(routeCapacity),
    claimCount: 0,
    claimIds: new Uint32Array(claimCapacity),
    needLane: AUTONOMY_REF_NONE,
    needValue: 0,
    ability: AUTONOMY_REF_NONE,
    scheduleCode: AUTONOMY_REF_NONE,
    rowVersion: 0,
    storeVersion: 0,
    basis: createBasis(),
    reason: createReason(),
    terminal: createTerminal(),
  };
}

function createClaimingInput(): AutonomyTransitionInput {
  const reason = createReason();
  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_OFFER_SELECTED,
    AUTONOMY_REASON_SOURCE_OFFER,
    0,
    1,
    5,
    2,
    0,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  const routeCells = new Uint32Array(AUTONOMY_MAX_ROUTE_CELLS);
  const claimIds = new Uint32Array(AUTONOMY_MAX_CLAIM_REFS);
  routeCells.fill(AUTONOMY_REF_NONE);
  claimIds.fill(AUTONOMY_REF_NONE);
  return {
    residentIndex: 0,
    residentGeneration: 1,
    expectedState: AUTONOMY_STATE_IDLE,
    expectedRowVersion: 1,
    nextState: AUTONOMY_STATE_CLAIMING,
    stateEnteredTick: 1,
    retryTick: 0,
    offerId: 3,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    targetEntityIndex: 5,
    targetEntityGeneration: 2,
    targetCellIndex: 7,
    routeCellCount: 0,
    routeCursor: 0,
    routeCells,
    claimCount: 0,
    claimIds,
    needLane: 0,
    needValue: 100,
    ability: 1,
    scheduleCode: 1,
    basis: createBasis(),
    reason,
  };
}

function createBasis(): AutonomyVersionBasis {
  return {
    needOwnerVersion: 99,
    scheduleVersion: 99,
    capabilityConditionVersion: 99,
    capabilityBaseVersion: 99,
    offerOwnerVersion: 99,
    offerRowVersion: 99,
    offerIndexVersion: 99,
    pathMapVersion: 99,
    pathNavigationVersion: 99,
    pathRegionVersion: 99,
    pathRoomVersion: 99,
    pathRegionGraphVersion: 99,
    reservationVersion: 99,
    jobVersion: 0,
  };
}

function writeAcquiredReason(input: AutonomyTransitionInput): void {
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    input.residentIndex,
    input.residentGeneration,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    input.basis.reservationVersion,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
}

function writeFailedInvariantReason(input: AutonomyTransitionInput): void {
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_FAILED_INVARIANT,
    AUTONOMY_REASON_SOURCE_SYSTEM,
    input.residentIndex,
    input.residentGeneration,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    input.basis.jobVersion,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
}

function createReason(): AutonomyReasonOutput {
  return {
    code: AUTONOMY_REASON_NONE,
    source: AUTONOMY_REASON_SOURCE_NONE,
    subjectIndex: AUTONOMY_REASON_REF_NONE,
    subjectGeneration: AUTONOMY_REASON_REF_NONE,
    targetIndex: AUTONOMY_REASON_REF_NONE,
    targetGeneration: AUTONOMY_REASON_REF_NONE,
    parameterCount: 0,
    parameter0: 0,
    parameter1: 0,
    parameter2: 0,
    parameter3: 0,
    parameter4: 0,
    parameter5: 0,
    ownerBasis: 0,
    suggestion: AUTONOMY_SUGGESTION_NONE,
  };
}

function createTerminal(): AutonomyTerminalOutput {
  return {
    present: true,
    state: AUTONOMY_STATE_IDLE,
    tick: 99,
    offerId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    jobVersion: 0,
    targetEntityIndex: AUTONOMY_REF_NONE,
    targetEntityGeneration: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    reason: createReason(),
  };
}

function cloneSnapshot(snapshot: ResidentAutonomySnapshot): ResidentAutonomySnapshot {
  return {
    snapshotVersion: snapshot.snapshotVersion,
    capacity: snapshot.capacity,
    storeVersion: snapshot.storeVersion,
    active: snapshot.active.slice(),
    lanes: snapshot.lanes.slice(),
    reasonParameters: snapshot.reasonParameters.slice(),
    ticks: snapshot.ticks.slice(),
    routeCells: snapshot.routeCells.slice(),
    claimIds: snapshot.claimIds.slice(),
  };
}

function expectAtomicRestoreFailure(
  store: ResidentAutonomyStore,
  snapshot: ResidentAutonomySnapshot,
  code: AutonomyStoreCode,
): void {
  const before = store.createSnapshot();
  const output = createStoreOutput();
  store.restoreFromSnapshot(snapshot, output);
  expect(output).toMatchObject({ ok: false, code });
  expect(store.createSnapshot()).toEqual(before);
}
