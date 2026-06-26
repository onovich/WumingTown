import { describe, expect, it } from "vitest";

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
  M5_SEASON_PRECONDITION_ARCHIVE_RISK,
  M5_SEASON_PRECONDITION_BRIDGE_ROUTE,
  M5_SEASON_PRECONDITION_MARKET_NIGHT,
  M5_SEASON_PRECONDITION_REGISTRATION_PRESSURE,
  M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
  M5_SEASON_RECOVERY_ARCHIVE,
  M5_SEASON_RECOVERY_BRIDGE_ROUTE,
  M5_SEASON_RECOVERY_MARKET,
  M5_SEASON_RECOVERY_NONE,
  M5_SEASON_RECOVERY_REGISTRATION,
  M5_SEASON_RECOVERY_RESOURCE,
  createM5SeasonEventPoolStore,
  createNamedRandomStreams,
  type M5SeasonEventCandidateInput,
  type M5SeasonEventCandidateView,
} from "./index";

describe("M5 first-season event pool", () => {
  it("registers first-season event and recovery candidates with versioned basis", () => {
    const store = createStore();
    const candidates = [
      createCandidate({ candidateId: 0, theme: M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE }),
      createCandidate({
        candidateId: 1,
        theme: M5_SEASON_EVENT_THEME_REGISTRATION_PRESSURE,
        preconditionMask: M5_SEASON_PRECONDITION_REGISTRATION_PRESSURE,
      }),
      createCandidate({
        candidateId: 2,
        theme: M5_SEASON_EVENT_THEME_MARKET_NIGHT,
        preconditionMask: M5_SEASON_PRECONDITION_MARKET_NIGHT,
      }),
      createCandidate({
        candidateId: 3,
        theme: M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE,
        preconditionMask: M5_SEASON_PRECONDITION_BRIDGE_ROUTE,
      }),
      createCandidate({
        candidateId: 4,
        theme: M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK,
        preconditionMask: M5_SEASON_PRECONDITION_ARCHIVE_RISK,
      }),
      createRecoveryCandidate({ candidateId: 5, recoveryType: M5_SEASON_RECOVERY_RESOURCE }),
    ];
    for (const candidate of candidates) {
      expect(store.registerCandidate(candidate)).toMatchObject({
        ok: true,
        reason: "m5_season_event_candidate_registered",
      });
    }

    expect(store.createMetrics()).toMatchObject({
      activeIncidentCandidateCount: 5,
      activeRecoveryCandidateCount: 1,
      ownerVersion: 6,
    });
    expect(requireCandidate(store.readCandidate(3))).toMatchObject({
      poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
      theme: M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE,
      anomalyOwnerVersion: 5,
      factionOwnerVersion: 7,
      governanceOwnerVersion: 11,
      seasonOwnerVersion: 13,
      resourceOwnerVersion: 17,
      recoveryBasisVersion: 19,
    });
  });

  it("selects legal event commands with deterministic random stream use", () => {
    const first = createStoreWithTwoIncidents();
    const second = createStoreWithTwoIncidents();
    const firstOutput = new Uint32Array(2);
    const secondOutput = new Uint32Array(2);
    const firstStreams = createNamedRandomStreams({ seed: "m5-season" });
    const secondStreams = createNamedRandomStreams({ seed: "m5-season" });

    const firstResult = first.selectEvent(
      createQuery({
        expectedPoolVersion: first.ownerVersion,
        selectedCap: 2,
        randomStreams: firstStreams,
      }),
      firstOutput,
    );
    const secondResult = second.selectEvent(
      createQuery({
        expectedPoolVersion: second.ownerVersion,
        selectedCap: 2,
        randomStreams: secondStreams,
      }),
      secondOutput,
    );

    expect(firstResult).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      selectedCommandKind: M5_SEASON_COMMAND_SCHEDULE_EVENT,
      reason: "m5_season_event_incident_selected",
    });
    expect(secondResult).toEqual(firstResult);
    expect([...secondOutput]).toEqual([...firstOutput]);
    expect(first.createMetrics()).toMatchObject({
      selectionCount: 1,
      cooldownWriteCount: 1,
      eventFreshnessWriteCount: 1,
    });
  });

  it("records precondition failures and bounds the failure ring", () => {
    const store = createStore();
    for (let candidateId = 0; candidateId < 3; candidateId += 1) {
      expect(
        store.registerCandidate(
          createCandidate({
            candidateId,
            preconditionMask: M5_SEASON_PRECONDITION_ARCHIVE_RISK,
            stableSequence: candidateId,
          }),
        ),
      ).toMatchObject({ ok: true });
    }

    const output = new Uint32Array(2);
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          satisfiedPreconditionMask: 0,
          candidateCap: 3,
          selectedCap: 2,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      rejectedPreconditionCount: 3,
      reason: "m5_season_event_precondition_failed",
    });
    expect(store.createMetrics()).toMatchObject({
      preconditionFailureCount: 3,
      preconditionFailureStoredCount: 2,
      nextPreconditionFailureSequence: 4,
    });
    expect(store.readPreconditionFailure(0)).toMatchObject({
      sequence: 3,
      missingPreconditionMask: M5_SEASON_PRECONDITION_ARCHIVE_RISK,
      reason: "m5_season_event_precondition_failed",
    });
    expect(store.readPreconditionFailure(1)).toMatchObject({ sequence: 2 });
  });

  it("applies cooldowns and freshness without mutating source facts", () => {
    const store = createStore();
    expect(
      store.registerCandidate(
        createCandidate({
          cooldownKey: 1,
          cooldownTicks: 50,
          freshnessWindowTicks: 100,
          preconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
        }),
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 20,
          selectedCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCandidateId: 0,
      reason: "m5_season_event_incident_selected",
    });
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 30,
          selectedCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      rejectedCooldownCount: 1,
      reason: "m5_season_event_cooldown_active",
    });
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 80,
          selectedCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      rejectedFreshnessCount: 1,
      reason: "m5_season_event_freshness_rejected",
    });
  });

  it("suppresses incidents during recovery windows and rejects wrong recovery types", () => {
    const store = createStore();
    expect(store.registerCandidate(createCandidate({ candidateId: 0, score: 1000 }))).toMatchObject(
      {
        ok: true,
      },
    );
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 1,
          recoveryType: M5_SEASON_RECOVERY_ARCHIVE,
          commandKind: M5_SEASON_COMMAND_ARCHIVE_REPAIR_OPPORTUNITY,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M5_SEASON_RECOVERY_RESOURCE,
        startTick: 10,
        endTick: 80,
        sourceCandidateVersion: 2,
      }),
    ).toMatchObject({ ok: true, reason: "m5_season_event_recovery_window_opened" });

    const output = new Uint32Array(1);
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 20,
          selectedCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      recoveryWindowActive: true,
      selectedCount: 0,
      visitedCount: 0,
      reason: "m5_season_event_wrong_recovery_type",
    });

    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 2,
          recoveryType: M5_SEASON_RECOVERY_RESOURCE,
          commandKind: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
          score: 900,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 30,
          selectedCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      recoveryWindowActive: true,
      selectedCandidateId: 2,
      selectedRecoveryType: M5_SEASON_RECOVERY_RESOURCE,
      selectedCommandKind: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
      reason: "m5_season_event_recovery_selected",
    });
  });

  it("keeps earlier recovery windows active after newer overlapping windows expire", () => {
    const store = createStore();
    expect(store.registerCandidate(createCandidate({ candidateId: 0, score: 1000 }))).toMatchObject(
      {
        ok: true,
      },
    );
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 1,
          recoveryType: M5_SEASON_RECOVERY_RESOURCE,
          commandKind: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
          score: 900,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 2,
          recoveryType: M5_SEASON_RECOVERY_ARCHIVE,
          commandKind: M5_SEASON_COMMAND_ARCHIVE_REPAIR_OPPORTUNITY,
          score: 800,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M5_SEASON_RECOVERY_RESOURCE,
        startTick: 10,
        endTick: 100,
        sourceCandidateVersion: 3,
      }),
    ).toMatchObject({ ok: true });
    expect(
      store.openRecoveryWindow({
        windowId: 1,
        recoveryType: M5_SEASON_RECOVERY_ARCHIVE,
        startTick: 20,
        endTick: 30,
        sourceCandidateVersion: 4,
      }),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 50,
          selectedCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      recoveryWindowActive: true,
      selectedCandidateId: 1,
      selectedRecoveryType: M5_SEASON_RECOVERY_RESOURCE,
      selectedCommandKind: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
      reason: "m5_season_event_recovery_selected",
    });
    expect(output[0]).toBe(1);
    expect(store.isRecoveryWindowActive(0, 50)).toBe(true);
    expect(store.isRecoveryWindowActive(1, 50)).toBe(false);
  });

  it("reports recovery precondition failures before wrong-type recovery fallback", () => {
    const store = createStore();
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 0,
          recoveryType: M5_SEASON_RECOVERY_RESOURCE,
          commandKind: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
          preconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M5_SEASON_RECOVERY_RESOURCE,
        startTick: 10,
        endTick: 80,
        sourceCandidateVersion: 1,
      }),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion,
          tick: 20,
          selectedCap: 1,
          satisfiedPreconditionMask: 0,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      recoveryWindowActive: true,
      selectedCount: 0,
      rejectedPreconditionCount: 1,
      reason: "m5_season_event_precondition_failed",
    });
    expect(store.readPreconditionFailure(0)).toMatchObject({
      candidateId: 0,
      missingPreconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
      reason: "m5_season_event_precondition_failed",
    });
  });

  it("rejects stale pool basis before selection output or owner state changes", () => {
    const store = createStoreWithTwoIncidents();
    const output = new Uint32Array([77]);
    expect(
      store.selectEvent(
        createQuery({
          expectedPoolVersion: store.ownerVersion - 1,
          selectedCap: 1,
        }),
        output,
      ),
    ).toEqual({ ok: false, reason: "m5_season_event_query_stale_basis" });
    expect([...output]).toEqual([77]);
    expect(store.createMetrics()).toMatchObject({ selectionCount: 0, ownerVersion: 2 });
  });
});

function createStore(): ReturnType<typeof createM5SeasonEventPoolStore> {
  return createM5SeasonEventPoolStore({
    candidateCapacity: 8,
    cooldownCapacity: 4,
    recoveryWindowCapacity: 4,
    preconditionFailureCapacity: 2,
  });
}

function createStoreWithTwoIncidents(): ReturnType<typeof createM5SeasonEventPoolStore> {
  const store = createStore();
  expect(
    store.registerCandidate(
      createCandidate({
        candidateId: 0,
        theme: M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE,
        preconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
        score: 900,
        priority: 10,
        cooldownKey: 1,
        cooldownTicks: 50,
        freshnessWindowTicks: 100,
        stableSequence: 1,
      }),
    ),
  ).toMatchObject({ ok: true });
  expect(
    store.registerCandidate(
      createCandidate({
        candidateId: 1,
        theme: M5_SEASON_EVENT_THEME_MARKET_NIGHT,
        preconditionMask: M5_SEASON_PRECONDITION_MARKET_NIGHT,
        score: 900,
        priority: 10,
        cooldownKey: 2,
        cooldownTicks: 50,
        freshnessWindowTicks: 100,
        stableSequence: 2,
      }),
    ),
  ).toMatchObject({ ok: true });
  return store;
}

function createQuery(
  overrides: Partial<
    Parameters<ReturnType<typeof createM5SeasonEventPoolStore>["selectEvent"]>[0]
  > = {},
): Parameters<ReturnType<typeof createM5SeasonEventPoolStore>["selectEvent"]>[0] {
  return {
    poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
    expectedPoolVersion: 0,
    tick: 20,
    satisfiedPreconditionMask:
      M5_SEASON_PRECONDITION_RESOURCE_PRESSURE |
      M5_SEASON_PRECONDITION_REGISTRATION_PRESSURE |
      M5_SEASON_PRECONDITION_MARKET_NIGHT |
      M5_SEASON_PRECONDITION_BRIDGE_ROUTE |
      M5_SEASON_PRECONDITION_ARCHIVE_RISK,
    candidateCap: 20,
    selectedCap: 8,
    streamName: "m5-season-events",
    randomStreams: createNamedRandomStreams({ seed: "m5-season-default" }),
    ...overrides,
  };
}

function createCandidate(
  overrides: Partial<M5SeasonEventCandidateInput> = {},
): M5SeasonEventCandidateInput {
  return {
    candidateId: 0,
    poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
    candidateKind: M5_SEASON_EVENT_KIND_INCIDENT,
    theme: M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE,
    recoveryType: M5_SEASON_RECOVERY_NONE,
    score: 600,
    priority: 100,
    cooldownKey: M5_SEASON_EVENT_NONE,
    cooldownTicks: 0,
    freshnessWindowTicks: 0,
    commandKind: M5_SEASON_COMMAND_SCHEDULE_EVENT,
    commandTargetId: 40,
    sourceEventDefId: 100,
    anomalyOwnerVersion: 5,
    factionOwnerVersion: 7,
    governanceOwnerVersion: 11,
    seasonOwnerVersion: 13,
    resourceOwnerVersion: 17,
    recoveryBasisVersion: 19,
    availableTick: 10,
    expiresTick: 100,
    preconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
    stableOwnerId: 1,
    stableSequence: 1,
    ...overrides,
  };
}

function createRecoveryCandidate(
  overrides: Partial<M5SeasonEventCandidateInput> = {},
): M5SeasonEventCandidateInput {
  const recoveryType = overrides.recoveryType ?? M5_SEASON_RECOVERY_RESOURCE;
  return createCandidate({
    candidateKind: M5_SEASON_EVENT_KIND_RECOVERY,
    theme: recoveryTheme(recoveryType),
    recoveryType,
    commandKind: recoveryCommand(recoveryType),
    preconditionMask: 0,
    ...overrides,
  });
}

function recoveryTheme(recoveryType: number): number {
  if (recoveryType === M5_SEASON_RECOVERY_REGISTRATION)
    return M5_SEASON_EVENT_THEME_REGISTRATION_PRESSURE;
  if (recoveryType === M5_SEASON_RECOVERY_MARKET) return M5_SEASON_EVENT_THEME_MARKET_NIGHT;
  if (recoveryType === M5_SEASON_RECOVERY_BRIDGE_ROUTE)
    return M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE;
  if (recoveryType === M5_SEASON_RECOVERY_ARCHIVE) return M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK;
  return M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE;
}

function recoveryCommand(recoveryType: number): number {
  if (recoveryType === M5_SEASON_RECOVERY_REGISTRATION)
    return M5_SEASON_COMMAND_REGISTRATION_OPPORTUNITY;
  if (recoveryType === M5_SEASON_RECOVERY_MARKET) return M5_SEASON_COMMAND_MARKET_NIGHT_OPPORTUNITY;
  if (recoveryType === M5_SEASON_RECOVERY_BRIDGE_ROUTE)
    return M5_SEASON_COMMAND_BRIDGE_ROUTE_OPPORTUNITY;
  if (recoveryType === M5_SEASON_RECOVERY_ARCHIVE)
    return M5_SEASON_COMMAND_ARCHIVE_REPAIR_OPPORTUNITY;
  return M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY;
}

function requireCandidate(
  value: M5SeasonEventCandidateView | undefined,
): M5SeasonEventCandidateView {
  if (value === undefined) throw new Error("expected season event candidate");
  return value;
}
