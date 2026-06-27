import { describe, expect, it } from "vitest";

import {
  M5_ALPHA_CONTENT_EXPECTED_TICKS,
  M5_ALPHA_CONTENT_SCENARIO_ID,
  M5_FINAL_TICK,
  M5_LOAD_TICK,
  M5_REBUILT_SURFACE_NAMES,
  M5_REPLAY_CHECKPOINT_SEQUENCE,
  M5_SAVE_TICK,
  M8_ENDGAME_ROUTE_STATE_AVAILABLE,
  M8_ENDGAME_ROUTE_STATE_BLOCKED,
  M8_ENDGAME_ROUTE_STATE_CONTESTED,
  createM5AlphaContentSaveEnvelope,
  createM5WorkerProjection,
  loadM5AlphaContentSaveEnvelope,
  resumeM5AlphaContentFromSave,
  runM5AlphaContentReplay,
  runM5AlphaContentScenario,
  runM8FactionEndgameScenario,
  type M5AlphaContentScenarioSummary,
  type M5ReplayRun,
} from "./index";

const REQUESTED_SEED = "5";
const LONG_HORIZON_TICKS = 100_000;
const SAMPLE_TICKS = [
  M5_SAVE_TICK,
  M5_ALPHA_CONTENT_EXPECTED_TICKS,
  60_000,
  80_000,
  LONG_HORIZON_TICKS,
] as const;
const LONG_REPLAY_CHECKPOINTS = [...M5_REPLAY_CHECKPOINT_SEQUENCE, LONG_HORIZON_TICKS] as const;
const SAVE_REPLAY_CHECKPOINTS = [M5_SAVE_TICK, M5_FINAL_TICK, LONG_HORIZON_TICKS] as const;

describe("M5 alpha content long-run invariants", () => {
  it("keeps content, anomaly, governance and event gates stable through 100000 ticks", () => {
    const samples = createSamples();
    const longRun = readLastSample(samples);
    const replay = readReplay(
      runM5AlphaContentReplay({
        seed: REQUESTED_SEED,
        checkpointTicks: LONG_REPLAY_CHECKPOINTS,
      }),
    );
    const replayAfterSave = readReplay(
      runM5AlphaContentReplay({
        seed: REQUESTED_SEED,
        checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
      }),
    );
    const save = createM5AlphaContentSaveEnvelope(REQUESTED_SEED, M5_SAVE_TICK);
    const loaded = loadM5AlphaContentSaveEnvelope(save);
    const resumed = readReplay(
      resumeM5AlphaContentFromSave({
        save,
        loadTick: M5_LOAD_TICK,
        finalTick: LONG_HORIZON_TICKS,
        checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
      }),
    );
    const workerProjection = createM5WorkerProjection(REQUESTED_SEED, M5_FINAL_TICK);
    const workerCheckpoint = readCheckpoint(replay, M5_FINAL_TICK);

    expect(longRun).toMatchObject({
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      requestedSeed: REQUESTED_SEED,
      authoritativeScenarioSeed: "155",
      finalTick: LONG_HORIZON_TICKS,
      tickRate: 30,
      contentHash: "0xe55d3015",
      commandStreamHash: "0x81d37435",
      finalWorldHash: "0xfba70a5c",
      readModelHash: "0x9ba83cb7",
    });
    expect(longRun.contentCatalog).toMatchObject({
      definitionCount: 30,
      catalogEntryCount: 20,
      blockedCatalogEntryCount: 1,
      blockedReasonCount: 1,
    });
    expect(longRun.roster).toMatchObject({
      definitionCount: 3,
      borrowedShadowVisitedCount: 1,
      borrowedShadowCandidateCapHit: true,
    });
    expect(longRun.thirdKnock.metrics).toMatchObject({
      activeCrisisCount: 0,
      resolvedCrisisCount: 1,
      failedCrisisCount: 0,
      totalCandidateVisits: 1,
      candidateCapHitCount: 1,
      traceStoredCount: 8,
    });
    expect(longRun.oldBridge.metrics).toMatchObject({
      activeCrisisCount: 0,
      resolvedCrisisCount: 1,
      failedCrisisCount: 0,
      terminalCleanupPendingCount: 0,
      totalCandidateVisits: 1,
      candidateCapHitCount: 1,
      traceStoredCount: 8,
    });
    expect(longRun.factionGovernance.factionMetrics).toMatchObject({
      activeFactCount: 4,
      totalQueryVisits: 4,
      queryCapHitCount: 1,
      staleBasisRejectCount: 0,
    });
    expect(longRun.factionGovernance.governanceMetrics).toMatchObject({
      activeHookCount: 4,
      totalQueryVisits: 8,
      riskBlockedCount: 1,
      staleBasisRejectCount: 0,
    });
    expect(longRun.season.metrics).toMatchObject({
      activeIncidentCandidateCount: 5,
      activeRecoveryCandidateCount: 2,
      selectionCount: 5,
      totalCandidateVisits: 8,
      cooldownWriteCount: 1,
      preconditionFailureCount: 5,
    });

    expect(replay.finalWorldHash).toBe(longRun.finalWorldHash);
    expect(replay.finalReadModelHash).toBe(longRun.readModelHash);
    expect(resumed.finalWorldHash).toBe(replayAfterSave.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(replayAfterSave.finalReadModelHash);
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }
    expect(loaded.rebuiltSurfaceNames).toEqual(M5_REBUILT_SURFACE_NAMES);
    expect(workerProjection).toBeDefined();
    if (workerProjection === undefined) {
      throw new Error("expected M5 Worker projection");
    }
    expect(workerProjection.worldHash).toBe(workerCheckpoint.worldHash);
    expect(workerProjection.authoritativeReadModelHash).toBe(workerCheckpoint.readModelHash);

    expect(noContentValidationDrift(samples)).toBe(true);
    expect(noAnomalyLeaks(samples)).toBe(true);
    expect(noFactionGovernanceHiddenAuthority(samples)).toBe(true);
    expect(noEventQueueGrowth(samples)).toBe(true);
    expect(noM0ToM4Regression(longRun)).toBe(true);
    expect(longRun.stopSigns).toMatchObject({
      m6Created: false,
      nextTasks: ["WM-0081", "WM-0082", "WM-0083"],
    });

    const endgame = runM8FactionEndgameScenario();
    expect(endgame.protectedM5BaselineTouched).toBe(false);
    expect(endgame.replay.matched).toBe(true);
    expect(endgame.metrics).toMatchObject({
      activeArcCount: 6,
      negotiatedArcCount: 6,
      activeRoutePathCount: 5,
      queryCapHitCount: 0,
      staleBasisRejectCount: 0,
    });
    expect(hasRouteState(endgame.routes, M8_ENDGAME_ROUTE_STATE_AVAILABLE)).toBe(true);
    expect(hasRouteState(endgame.routes, M8_ENDGAME_ROUTE_STATE_BLOCKED)).toBe(true);
    expect(hasRouteState(endgame.routes, M8_ENDGAME_ROUTE_STATE_CONTESTED)).toBe(true);
  });
});

function createSamples(): readonly M5AlphaContentScenarioSummary[] {
  const samples: M5AlphaContentScenarioSummary[] = [];
  for (const tick of SAMPLE_TICKS) {
    samples.push(runM5AlphaContentScenario({ seed: REQUESTED_SEED, ticks: tick }));
  }
  return samples;
}

function readReplay(result: ReturnType<typeof runM5AlphaContentReplay>): M5ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readLastSample(
  samples: readonly M5AlphaContentScenarioSummary[],
): M5AlphaContentScenarioSummary {
  const summary = samples[samples.length - 1];
  if (summary === undefined) {
    throw new Error("M5 invariant gate expected at least one sample");
  }
  return summary;
}

function readCheckpoint(replay: M5ReplayRun, tick: number): M5ReplayRun["checkpoints"][number] {
  for (const checkpoint of replay.checkpoints) {
    if (checkpoint.tick === tick) {
      return checkpoint;
    }
  }
  throw new Error(`missing M5 replay checkpoint ${String(tick)}`);
}

function noContentValidationDrift(samples: readonly M5AlphaContentScenarioSummary[]): boolean {
  const first = samples[0] ?? failMissingSample();
  for (const sample of samples) {
    if (
      sample.contentHash !== first.contentHash ||
      sample.contentCatalog.definitionCount !== first.contentCatalog.definitionCount ||
      sample.contentCatalog.catalogEntryCount !== first.contentCatalog.catalogEntryCount ||
      sample.contentCatalog.blockedReasonCount !== first.contentCatalog.blockedReasonCount
    ) {
      return false;
    }
  }
  return true;
}

function noAnomalyLeaks(samples: readonly M5AlphaContentScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.thirdKnock.metrics.activeCrisisCount !== 0 ||
      sample.thirdKnock.metrics.resolvedCrisisCount !== 1 ||
      sample.thirdKnock.metrics.failedCrisisCount !== 0 ||
      sample.oldBridge.metrics.activeCrisisCount !== 0 ||
      sample.oldBridge.metrics.resolvedCrisisCount !== 1 ||
      sample.oldBridge.metrics.failedCrisisCount !== 0 ||
      sample.oldBridge.metrics.terminalCleanupPendingCount !== 0
    ) {
      return false;
    }
  }
  return true;
}

function noFactionGovernanceHiddenAuthority(
  samples: readonly M5AlphaContentScenarioSummary[],
): boolean {
  for (const sample of samples) {
    if (
      sample.factionGovernance.factionMetrics.activeFactCount !== 4 ||
      sample.factionGovernance.factionMetrics.totalQueryVisits !== 4 ||
      sample.factionGovernance.factionMetrics.staleBasisRejectCount !== 0 ||
      sample.factionGovernance.governanceMetrics.activeHookCount !== 4 ||
      sample.factionGovernance.governanceMetrics.totalQueryVisits !== 8 ||
      sample.factionGovernance.governanceMetrics.riskBlockedCount !== 1 ||
      sample.factionGovernance.governanceMetrics.staleBasisRejectCount !== 0 ||
      !sample.factionGovernance.governanceAllowed.ok ||
      !sample.factionGovernance.governanceAllowed.allowed ||
      !sample.factionGovernance.governanceBlocked.ok ||
      sample.factionGovernance.governanceBlocked.allowed
    ) {
      return false;
    }
  }
  return true;
}

function noEventQueueGrowth(samples: readonly M5AlphaContentScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.season.metrics.activeIncidentCandidateCount !== 5 ||
      sample.season.metrics.activeRecoveryCandidateCount !== 2 ||
      sample.season.metrics.selectionCount !== 5 ||
      sample.season.metrics.totalCandidateVisits !== 8 ||
      sample.season.metrics.cooldownWriteCount !== 1 ||
      sample.season.metrics.preconditionFailureStoredCount >
        sample.season.metrics.preconditionFailureCount
    ) {
      return false;
    }
  }
  return true;
}

function noM0ToM4Regression(summary: M5AlphaContentScenarioSummary): boolean {
  const evidence: Record<string, string | boolean> = {
    unchanged: summary.m4Regression.unchanged,
    contentHash: summary.m4Regression.contentHash,
    commandStreamHash: summary.m4Regression.commandStreamHash,
    finalWorldHash: summary.m4Regression.finalWorldHash,
    readModelHash: summary.m4Regression.readModelHash,
  };
  return (
    evidence["unchanged"] === true &&
    evidence["contentHash"] === "0x698f2c41" &&
    evidence["commandStreamHash"] === "0x538d0e43" &&
    evidence["finalWorldHash"] === "0xc201a925" &&
    evidence["readModelHash"] === "0xce261d9d"
  );
}

function failMissingSample(): never {
  throw new Error("M5 invariant gate expected at least one sample");
}

function hasRouteState(
  routes: readonly { readonly routeState: number }[],
  routeState: number,
): boolean {
  for (const route of routes) {
    if (route.routeState === routeState) return true;
  }
  return false;
}
