import {
  M5_ALPHA_CATALOG_ENTRY_COUNT,
  M5_ALPHA_DEFINITION_COUNT,
  createM5AlphaContentCatalogPack,
  listM5AlphaCatalogReviewNotes,
  validateM5ContentPack,
  type M5ContentManifest,
  type M5ContentValidationCounters,
  type ValidatedDefinitionFile,
} from "@wuming-town/content-schema";

import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import { createNamedRandomStreams } from "./deterministic-rng";
import {
  M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
  M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME,
  M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
  M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH,
  M4_BORROWED_SHADOW_MIN_GAP_SCORE,
} from "./m4-borrowed-shadow-types";
import { M4_EVIDENCE_TIER_CONFIRMED } from "./m4-chronicle-types";
import { runM4CoreVerticalSliceScenario } from "./m4-core-vertical-slice-scenario";
import {
  createM5AnomalyRosterStore,
  createM5BorrowedShadowAnomalyDefinition,
  createM5OldBridgeGuestAnomalyDefinition,
  createM5ThirdKnockAnomalyDefinition,
} from "./m5-anomaly-roster";
import {
  M5_ANOMALY_DEF_BORROWED_SHADOW,
  M5_ANOMALY_DEF_OLD_BRIDGE_GUEST,
  M5_ANOMALY_DEF_THIRD_KNOCK,
  type M5AnomalyDefinitionView,
} from "./m5-anomaly-roster-types";
import {
  M5_FACTION_FACT_KIND_DEBT_STANCE,
  M5_FACTION_FACT_KIND_LEGAL_STANCE,
  M5_FACTION_FACT_KIND_LEGITIMACY,
  M5_FACTION_FACT_KIND_TRADE_STANCE,
  M5_FACTION_FACT_MASK_DEBT_STANCE,
  M5_FACTION_FACT_MASK_LEGAL_STANCE,
  M5_FACTION_FACT_MASK_TRADE_STANCE,
  M5_FACTION_GOVERNANCE_NONE,
  M5_GOVERNANCE_COUNCIL_POST_LAMPKEEPER,
  M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY,
  M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
  M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
  M5_GOVERNANCE_HOOK_MASK_ALL,
  M5_GOVERNANCE_HOOK_RISK_FLAG,
  M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY,
  M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
  type M5FactionFactInput,
  type M5FactionFactQueryResult,
  type M5FactionMetrics,
  type M5GovernanceHookInput,
  type M5GovernanceHookQueryResult,
  type M5GovernanceMetrics,
} from "./m5-faction-governance-types";
import { createM5FactionFactStore } from "./m5-faction-store";
import { createM5GovernanceHookStore } from "./m5-governance-store";
import {
  M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
  M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
  M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
  M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
  M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
  M5_OLD_BRIDGE_NONE,
  M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
  M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
  type M5OldBridgeActivationBasis,
  type M5OldBridgeMetrics,
  type M5OldBridgeReviewView,
  type M5OldBridgeTerminalCleanupResult,
} from "./m5-old-bridge-types";
import { createM5OldBridgeGuestCrisisStore } from "./m5-old-bridge";
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
  type M5SeasonEventCandidateInput,
  type M5SeasonEventMetrics,
  type M5SeasonEventSelectionResult,
} from "./m5-season-events-types";
import { createM5SeasonEventPoolStore } from "./m5-season-event-pool";
import {
  M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
  M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
  M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
  M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
  M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
  M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
  M5_THIRD_KNOCK_TERMINAL_CONTAINED,
  type M5ThirdKnockAccidentReviewView,
  type M5ThirdKnockActivationBasis,
  type M5ThirdKnockMetrics,
} from "./m5-third-knock-types";
import { createM5ThirdKnockCrisisStore } from "./m5-third-knock";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";

export const M5_ALPHA_CONTENT_SCENARIO_ID = "m5.alpha_content_framework.first_season.v1";
export const M5_ALPHA_CONTENT_ALIAS = "m5-alpha-content-framework";
export const M5_ALPHA_CONTENT_EXPECTED_TICKS = 36_000;

const M5_ALPHA_ROSTER_VERSION = 5;
const M5_ALPHA_STREAM_NAME = "m5-alpha-season-events";

export type M5AlphaContentScenarioReason =
  | "m5.alpha.scenario.initialized"
  | "m5.alpha.content_catalog.accepted"
  | "m5.alpha.anomaly_roster.loaded"
  | "m5.alpha.borrowed_shadow.rostered"
  | "m5.alpha.third_knock.non_combat_contained"
  | "m5.alpha.old_bridge.reciprocity_resolved"
  | "m5.alpha.faction_strategy.selected"
  | "m5.alpha.governance_policy.allowed"
  | "m5.alpha.governance_policy.risk_blocked"
  | "m5.alpha.season.precondition_failed"
  | "m5.alpha.season.incident_selected"
  | "m5.alpha.season.cooldown_recorded"
  | "m5.alpha.season.recovery_selected"
  | "m5.alpha.m4_regression.preserved"
  | "m5.alpha.downstream.stop_signs.recorded";

export interface M5AlphaContentScenarioOptions {
  readonly seed: string;
  readonly ticks: Tick;
}

export interface M5AlphaCommandEntry {
  readonly tick: Tick;
  readonly sequence: number;
  readonly reason: M5AlphaContentScenarioReason;
  readonly subjectId: number;
  readonly targetId: number;
}

export interface M5AlphaContentCatalogEvidence {
  readonly definitionCount: number;
  readonly catalogEntryCount: number;
  readonly reviewNoteCount: number;
  readonly blockedCatalogEntryCount: number;
  readonly blockedReasonCount: number;
  readonly contentHash: string;
}

export interface M5AlphaRosterEvidence {
  readonly rosterVersion: number;
  readonly definitionCount: number;
  readonly contentManifestHash: string;
  readonly borrowedShadowDefId: typeof M5_ANOMALY_DEF_BORROWED_SHADOW;
  readonly thirdKnockDefId: typeof M5_ANOMALY_DEF_THIRD_KNOCK;
  readonly oldBridgeDefId: typeof M5_ANOMALY_DEF_OLD_BRIDGE_GUEST;
  readonly selectedBorrowedShadowCandidateId: number;
  readonly borrowedShadowVisitedCount: number;
  readonly borrowedShadowCandidateCapHit: boolean;
  readonly borrowedShadowSelectedCapHit: boolean;
}

export interface M5AlphaBorrowedShadowEvidence {
  readonly rostered: true;
  readonly activationCandidateId: number;
  readonly evidenceKinds: readonly number[];
  readonly minActivationScore: number;
  readonly m4ContainmentLowRiskEvidenceCount: number;
  readonly m4DawnReviewRowCount: number;
  readonly m4PreventionPathReason: string;
  readonly m4ContainmentPathReason: string;
}

export interface M5AlphaThirdKnockEvidence {
  readonly selectedCandidateId: number;
  readonly queryVisitedCount: number;
  readonly queryCandidateCapHit: boolean;
  readonly activationReason: string;
  readonly evidenceKinds: readonly number[];
  readonly lowRiskEvidenceCount: number;
  readonly terminalReason: number;
  readonly review: M5ThirdKnockAccidentReviewView;
  readonly preventionReason: string;
  readonly metrics: M5ThirdKnockMetrics;
}

export interface M5AlphaOldBridgeEvidence {
  readonly selectedCandidateId: number;
  readonly queryVisitedCount: number;
  readonly queryCandidateCapHit: boolean;
  readonly activationReason: string;
  readonly evidenceKinds: readonly number[];
  readonly lowRiskEvidenceCount: number;
  readonly terminalReason: number;
  readonly review: M5OldBridgeReviewView;
  readonly cleanup: M5OldBridgeTerminalCleanupResult;
  readonly metrics: M5OldBridgeMetrics;
}

export interface M5AlphaFactionGovernanceEvidence {
  readonly factionQuery: M5FactionFactQueryResult;
  readonly factionSelectedFactIds: readonly number[];
  readonly factionMetrics: M5FactionMetrics;
  readonly governanceAllowed: M5GovernanceHookQueryResult;
  readonly governanceBlocked: M5GovernanceHookQueryResult;
  readonly governanceSelectedHookIds: readonly number[];
  readonly governanceMetrics: M5GovernanceMetrics;
}

export interface M5AlphaSeasonEvidence {
  readonly preconditionFailure: M5SeasonEventSelectionResult;
  readonly latestPreconditionFailureReason: string;
  readonly incidentSelection: M5SeasonEventSelectionResult;
  readonly cooldownSelection: M5SeasonEventSelectionResult;
  readonly recoveryPreconditionFailure: M5SeasonEventSelectionResult;
  readonly recoverySelection: M5SeasonEventSelectionResult;
  readonly metrics: M5SeasonEventMetrics;
}

export interface M5AlphaStrategyPathEvidence {
  readonly pathId:
    | "evidence_first"
    | "lamp_patrol"
    | "faction_negotiation"
    | "conservative_governance";
  readonly primaryCommand: number;
  readonly anomalyDefId: string;
  readonly selectedEventCandidateId: number;
  readonly selectedOwnerCount: number;
  readonly nonCombatResolution: boolean;
  readonly structuredReason: M5AlphaContentScenarioReason;
}

export interface M5AlphaRegressionEvidence {
  readonly scenarioId: "m4.core_vertical_slice.borrowed_shadow_lamps.v1";
  readonly requestedSeed: "4";
  readonly authoritativeScenarioSeed: string;
  readonly contentHash: "0x698f2c41";
  readonly commandStreamHash: "0x538d0e43";
  readonly finalWorldHash: "0xc201a925";
  readonly readModelHash: "0xce261d9d";
  readonly unchanged: true;
}

export interface M5AlphaStopSigns {
  readonly saveReplayImplemented: false;
  readonly workerProjectionImplemented: false;
  readonly benchmarkBaselineUpdated: false;
  readonly m6Created: false;
  readonly nextTasks: readonly ["WM-0081", "WM-0082", "WM-0083"];
}

export interface M5AlphaContentScenarioSummary {
  readonly version: 1;
  readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
  readonly alias: typeof M5_ALPHA_CONTENT_ALIAS;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly authoritativeScenarioSeed: string;
  readonly finalTick: Tick;
  readonly tickRate: 30;
  readonly contentHash: string;
  readonly commandStreamHash: string;
  readonly finalWorldHash: string;
  readonly readModelHash: string;
  readonly contentCatalog: M5AlphaContentCatalogEvidence;
  readonly roster: M5AlphaRosterEvidence;
  readonly borrowedShadow: M5AlphaBorrowedShadowEvidence;
  readonly thirdKnock: M5AlphaThirdKnockEvidence;
  readonly oldBridge: M5AlphaOldBridgeEvidence;
  readonly factionGovernance: M5AlphaFactionGovernanceEvidence;
  readonly season: M5AlphaSeasonEvidence;
  readonly strategyPaths: readonly M5AlphaStrategyPathEvidence[];
  readonly m4Regression: M5AlphaRegressionEvidence;
  readonly stopSigns: M5AlphaStopSigns;
}

interface ScenarioRun {
  readonly contentCatalog: M5AlphaContentCatalogEvidence;
  readonly roster: M5AlphaRosterEvidence;
  readonly borrowedShadow: M5AlphaBorrowedShadowEvidence;
  readonly thirdKnock: M5AlphaThirdKnockEvidence;
  readonly oldBridge: M5AlphaOldBridgeEvidence;
  readonly factionGovernance: M5AlphaFactionGovernanceEvidence;
  readonly season: M5AlphaSeasonEvidence;
  readonly strategyPaths: readonly M5AlphaStrategyPathEvidence[];
  readonly m4Regression: M5AlphaRegressionEvidence;
}

export function runM5AlphaContentScenario(
  options: M5AlphaContentScenarioOptions,
): M5AlphaContentScenarioSummary {
  if (options.seed.length === 0 || !isSafeTick(options.ticks)) {
    throw new Error("M5 alpha content scenario requires a non-empty seed and safe tick count");
  }

  const authoritativeScenarioSeed = deriveM5AlphaContentScenarioSeed(options.seed);
  const commands = createCommandStream();
  const run = runScenarioOnce(authoritativeScenarioSeed);
  const commandStreamHash = formatUint32Hex(
    createCommandStreamHash(commands, authoritativeScenarioSeed),
  );
  const finalWorldHash = createFinalWorldHash(options.ticks, authoritativeScenarioSeed, run);
  const readModelHash = createReadModelHash(options.ticks, authoritativeScenarioSeed, run);

  return {
    version: 1,
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    alias: M5_ALPHA_CONTENT_ALIAS,
    seed: authoritativeScenarioSeed,
    requestedSeed: options.seed,
    authoritativeScenarioSeed,
    finalTick: options.ticks,
    tickRate: 30,
    contentHash: run.contentCatalog.contentHash,
    commandStreamHash,
    finalWorldHash,
    readModelHash,
    contentCatalog: run.contentCatalog,
    roster: run.roster,
    borrowedShadow: run.borrowedShadow,
    thirdKnock: run.thirdKnock,
    oldBridge: run.oldBridge,
    factionGovernance: run.factionGovernance,
    season: run.season,
    strategyPaths: run.strategyPaths,
    m4Regression: run.m4Regression,
    stopSigns: createStopSigns(),
  };
}

export function deriveM5AlphaContentScenarioSeed(requestedSeed: string): string {
  let hash = hashStringToUint32(M5_ALPHA_CONTENT_SCENARIO_ID);
  hash = mixUint32(hash, hashStringToUint32(requestedSeed));
  return String(70 + (hash % 90));
}

function runScenarioOnce(authoritativeScenarioSeed: string): ScenarioRun {
  const contentCatalog = createContentCatalogEvidence();
  const rosterStore = createM5AnomalyRosterStore({ definitionCapacity: 4, candidateCapacity: 8 });
  mustOk(
    rosterStore.loadCompiledRoster({
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentCatalog.contentHash,
      validationBasis: "WM-0080.m5.alpha.content.framework.validation.v1",
      definitions: [
        createM5BorrowedShadowAnomalyDefinition(),
        createM5ThirdKnockAnomalyDefinition(),
        createM5OldBridgeGuestAnomalyDefinition(),
      ],
    }),
  );

  const borrowedShadowDefinition = requireDefinition(rosterStore.readDefinition(0));
  const thirdKnockDefinition = requireDefinition(rosterStore.readDefinition(1));
  const oldBridgeDefinition = requireDefinition(rosterStore.readDefinition(2));
  const roster = runRosterEvidence(
    rosterStore,
    contentCatalog.contentHash,
    borrowedShadowDefinition,
    thirdKnockDefinition,
    oldBridgeDefinition,
  );
  const m4Regression = createM4RegressionEvidence();
  const borrowedShadow = createBorrowedShadowEvidence(m4Regression, roster);
  const thirdKnock = runThirdKnockEvidence(contentCatalog.contentHash, thirdKnockDefinition);
  const oldBridge = runOldBridgeEvidence(contentCatalog.contentHash, oldBridgeDefinition);
  const factionGovernance = runFactionGovernanceEvidence();
  const season = runSeasonEvidence(authoritativeScenarioSeed, factionGovernance);
  const strategyPaths = createStrategyPaths(
    roster,
    thirdKnock,
    oldBridge,
    factionGovernance,
    season,
  );

  return {
    contentCatalog,
    roster,
    borrowedShadow,
    thirdKnock,
    oldBridge,
    factionGovernance,
    season,
    strategyPaths,
    m4Regression,
  };
}

function createContentCatalogEvidence(): M5AlphaContentCatalogEvidence {
  const notes = listM5AlphaCatalogReviewNotes();
  let blocked = 0;
  let blockedReasons = 0;
  for (const note of notes) {
    if (note.blockedReason !== undefined) {
      blocked += 1;
      blockedReasons += 1;
    }
  }
  return {
    definitionCount: M5_ALPHA_DEFINITION_COUNT,
    catalogEntryCount: M5_ALPHA_CATALOG_ENTRY_COUNT,
    reviewNoteCount: notes.length,
    blockedCatalogEntryCount: blocked,
    blockedReasonCount: blockedReasons,
    contentHash: createContentManifestHash(),
  };
}

function runRosterEvidence(
  rosterStore: ReturnType<typeof createM5AnomalyRosterStore>,
  contentHash: string,
  borrowedShadowDefinition: M5AnomalyDefinitionView,
  thirdKnockDefinition: M5AnomalyDefinitionView,
  oldBridgeDefinition: M5AnomalyDefinitionView,
): M5AlphaRosterEvidence {
  mustOk(
    rosterStore.registerActivationCandidate({
      candidateId: 0,
      defIndex: borrowedShadowDefinition.defIndex,
      stateOwnerId: 10,
      score: M4_BORROWED_SHADOW_MIN_GAP_SCORE + 20,
      priority: 900,
      stableOwnerId: 100,
      stableSequence: 1,
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      borrowedShadowBasis: createBorrowedShadowBasis(0),
    }),
  );
  mustOk(
    rosterStore.registerActivationCandidate({
      candidateId: 1,
      defIndex: borrowedShadowDefinition.defIndex,
      stateOwnerId: 11,
      score: M4_BORROWED_SHADOW_MIN_GAP_SCORE,
      priority: 800,
      stableOwnerId: 101,
      stableSequence: 2,
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      borrowedShadowBasis: createBorrowedShadowBasis(1),
    }),
  );
  mustOk(
    rosterStore.registerActivationCandidate({
      candidateId: 2,
      defIndex: thirdKnockDefinition.defIndex,
      stateOwnerId: 20,
      score: 720,
      priority: 600,
      stableOwnerId: 200,
      stableSequence: 1,
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      borrowedShadowBasis: createBorrowedShadowBasis(2),
    }),
  );
  mustOk(
    rosterStore.registerActivationCandidate({
      candidateId: 3,
      defIndex: oldBridgeDefinition.defIndex,
      stateOwnerId: 30,
      score: 740,
      priority: 650,
      stableOwnerId: 300,
      stableSequence: 1,
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      borrowedShadowBasis: createBorrowedShadowBasis(3),
    }),
  );

  const output = new Uint32Array(1);
  const query = rosterStore.queryActivationCandidates(
    {
      defIndex: borrowedShadowDefinition.defIndex,
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      minScore: M4_BORROWED_SHADOW_MIN_GAP_SCORE,
      candidateCap: 1,
      selectedCap: 1,
    },
    output,
  );
  mustOk(query);

  return {
    rosterVersion: M5_ALPHA_ROSTER_VERSION,
    definitionCount: rosterStore.createMetrics().definitionCount,
    contentManifestHash: contentHash,
    borrowedShadowDefId: M5_ANOMALY_DEF_BORROWED_SHADOW,
    thirdKnockDefId: M5_ANOMALY_DEF_THIRD_KNOCK,
    oldBridgeDefId: M5_ANOMALY_DEF_OLD_BRIDGE_GUEST,
    selectedBorrowedShadowCandidateId: output[0] ?? 0,
    borrowedShadowVisitedCount: query.visitedCount,
    borrowedShadowCandidateCapHit: query.candidateCapHit,
    borrowedShadowSelectedCapHit: query.selectedCapHit,
  };
}

function createBorrowedShadowEvidence(
  m4Regression: M5AlphaRegressionEvidence,
  roster: M5AlphaRosterEvidence,
): M5AlphaBorrowedShadowEvidence {
  const m4 = runM4CoreVerticalSliceScenario({ seed: "4", ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS });
  if (
    m4.contentHash !== m4Regression.contentHash ||
    m4.commandStreamHash !== m4Regression.commandStreamHash ||
    m4.finalWorldHash !== m4Regression.finalWorldHash ||
    m4.readModelHash !== m4Regression.readModelHash
  ) {
    throw new Error("M5 alpha scenario detected an M4 regression while lifting borrowed shadow");
  }

  return {
    rostered: true,
    activationCandidateId: roster.selectedBorrowedShadowCandidateId,
    evidenceKinds: [
      M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
      M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH,
      M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME,
      M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
    ],
    minActivationScore: M4_BORROWED_SHADOW_MIN_GAP_SCORE,
    m4ContainmentLowRiskEvidenceCount: m4.containmentPath.lowRiskEvidenceCount,
    m4DawnReviewRowCount: m4.dawnReviewRows.length,
    m4PreventionPathReason: m4.preventionPath.reason,
    m4ContainmentPathReason: m4.containmentPath.reason,
  };
}

function runThirdKnockEvidence(
  contentHash: string,
  definition: M5AnomalyDefinitionView,
): M5AlphaThirdKnockEvidence {
  const store = createM5ThirdKnockCrisisStore({
    candidateCapacity: 6,
    crisisCapacity: 4,
    traceCapacity: 12,
    accidentReviewCapacity: 4,
  });

  mustOk(store.registerActivationCandidate(createThirdKnockBasis(0, contentHash), definition));
  mustOk(
    store.registerActivationCandidate(
      createThirdKnockBasis(1, contentHash, { invitationDebtScore: 599 }),
      definition,
    ),
  );
  const prevention = store.activateCandidate({ candidateId: 1, crisisId: 1, tick: 99 });
  const queryOutput = new Uint32Array(1);
  const query = store.queryActivationCandidates(
    {
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      candidateCap: 1,
      selectedCap: 1,
      minInvitationDebtScore: 0,
    },
    queryOutput,
  );
  mustOk(query);
  const activation = store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 120 });
  mustOk(activation);
  const evidenceKinds = [
    M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
    M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
    M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
    M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
    M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
  ];
  for (let index = 0; index < evidenceKinds.length; index += 1) {
    mustOk(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: evidenceKinds[index] ?? 0,
        tick: 121 + index,
      }),
    );
  }
  mustOk(store.escalateCrisis(0, 140));
  mustOk(
    store.resolveCrisis({
      crisisId: 0,
      method: M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
      tick: 150,
      thresholdSealed: 1,
      witnessesAligned: 1,
      policyPublished: 0,
      debtAcknowledged: 0,
      containmentScore: 720,
      policyScore: 0,
    }),
  );

  const crisis = store.readCrisis(0);
  const review = store.readAccidentReview(0);
  if (crisis === undefined || review === undefined) {
    throw new Error("M5 third-knock evidence path did not create crisis review rows");
  }

  return {
    selectedCandidateId: queryOutput[0] ?? 0,
    queryVisitedCount: query.visitedCount,
    queryCandidateCapHit: query.candidateCapHit,
    activationReason: activation.reason,
    evidenceKinds,
    lowRiskEvidenceCount: crisis.lowRiskEvidenceCount,
    terminalReason: crisis.terminalReason,
    review,
    preventionReason: prevention.ok ? prevention.reason : prevention.reason,
    metrics: store.createMetrics(),
  };
}

function runOldBridgeEvidence(
  contentHash: string,
  definition: M5AnomalyDefinitionView,
): M5AlphaOldBridgeEvidence {
  const store = createM5OldBridgeGuestCrisisStore({
    candidateCapacity: 6,
    crisisCapacity: 4,
    traceCapacity: 12,
    reviewCapacity: 4,
  });

  mustOk(store.registerActivationCandidate(createOldBridgeBasis(0, contentHash), definition));
  mustOk(
    store.registerActivationCandidate(
      createOldBridgeBasis(1, contentHash, {
        reciprocityDebtScore: 900,
        priority: 900,
        stableOwnerId: 150,
      }),
      definition,
    ),
  );
  const queryOutput = new Uint32Array(1);
  const query = store.queryActivationCandidates(
    {
      rosterVersion: M5_ALPHA_ROSTER_VERSION,
      contentManifestHash: contentHash,
      candidateCap: 1,
      selectedCap: 1,
      minReciprocityDebtScore: 0,
    },
    queryOutput,
  );
  mustOk(query);
  const activation = store.activateCandidate({ candidateId: 1, crisisId: 0, tick: 220 });
  mustOk(activation);
  const evidenceKinds = [
    M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
    M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
    M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
    M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
    M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
  ];
  for (let index = 0; index < evidenceKinds.length; index += 1) {
    mustOk(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: evidenceKinds[index] ?? 0,
        tick: 221 + index,
      }),
    );
  }
  mustOk(store.escalateCrisis(0, 240));
  mustOk(
    store.resolveCrisis({
      crisisId: 0,
      method: M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
      tick: 250,
      preparedItemDelivered: 1,
      routeReplanned: 0,
      obligationSettled: 0,
      reciprocityScore: 740,
      rerouteScore: 0,
      settlementScore: 0,
    }),
  );

  const cleanupOutput = new Uint32Array(1);
  const cleanup = store.drainTerminalCleanup(1, cleanupOutput);
  mustOk(cleanup);
  const crisis = store.readCrisis(0);
  const review = store.readReview(0);
  if (crisis === undefined || review === undefined) {
    throw new Error("M5 old-bridge evidence path did not create crisis review rows");
  }

  return {
    selectedCandidateId: queryOutput[0] ?? 0,
    queryVisitedCount: query.visitedCount,
    queryCandidateCapHit: query.candidateCapHit,
    activationReason: activation.reason,
    evidenceKinds,
    lowRiskEvidenceCount: crisis.lowRiskEvidenceCount,
    terminalReason: crisis.terminalReason,
    review,
    cleanup,
    metrics: store.createMetrics(),
  };
}

function runFactionGovernanceEvidence(): M5AlphaFactionGovernanceEvidence {
  const factionStore = createM5FactionFactStore({ factCapacity: 8, factionCapacity: 4 });
  mustOk(factionStore.upsertFact(createFactionFact({ factId: 0, priority: 500 })));
  mustOk(
    factionStore.upsertFact(
      createFactionFact({
        factId: 1,
        kind: M5_FACTION_FACT_KIND_TRADE_STANCE,
        value: 740,
        priority: 900,
        stableSequence: 1,
      }),
    ),
  );
  mustOk(
    factionStore.upsertFact(
      createFactionFact({
        factId: 2,
        kind: M5_FACTION_FACT_KIND_DEBT_STANCE,
        value: 820,
        priority: 850,
        stableSequence: 2,
      }),
    ),
  );
  mustOk(
    factionStore.upsertFact(
      createFactionFact({
        factId: 3,
        kind: M5_FACTION_FACT_KIND_LEGITIMACY,
        value: 680,
        priority: 700,
        stableSequence: 3,
      }),
    ),
  );

  const factOutput = new Uint32Array(2);
  const factionQuery = factionStore.queryFacts(
    {
      factionId: 1,
      expectedOwnerVersion: factionStore.ownerVersion,
      subjectId: M5_FACTION_GOVERNANCE_NONE,
      kindMask:
        M5_FACTION_FACT_MASK_LEGAL_STANCE |
        M5_FACTION_FACT_MASK_TRADE_STANCE |
        M5_FACTION_FACT_MASK_DEBT_STANCE,
      minValue: 0,
      candidateCap: 2,
      scanCap: 4,
    },
    factOutput,
  );
  mustOk(factionQuery);

  const governanceStore = createM5GovernanceHookStore({ hookCapacity: 8, policyCapacity: 4 });
  mustOk(
    governanceStore.upsertHook(
      createGovernanceHook({
        hookId: 0,
        hookKind: M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY,
        councilPostId: M5_GOVERNANCE_COUNCIL_POST_LAMPKEEPER,
        enforcementCapacity: 140,
        legitimacyScore: 240,
        priority: 700,
        stableSequence: 2,
      }),
    ),
  );
  mustOk(
    governanceStore.upsertHook(
      createGovernanceHook({
        hookId: 1,
        hookKind: M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY,
        temporaryPolicyId: 60,
        enforcementCapacity: 260,
        legitimacyScore: 320,
        priority: 900,
        stableSequence: 1,
      }),
    ),
  );
  mustOk(
    governanceStore.upsertHook(
      createGovernanceHook({
        hookId: 2,
        hookKind: M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
        legitimacyScore: 240,
        priority: 650,
        stableSequence: 3,
      }),
    ),
  );
  mustOk(
    governanceStore.upsertHook(
      createGovernanceHook({
        hookId: 3,
        hookKind: M5_GOVERNANCE_HOOK_RISK_FLAG,
        enforcementCapacity: 0,
        legitimacyScore: 0,
        riskFlags: M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
        priority: 500,
        stableSequence: 4,
      }),
    ),
  );

  const hookOutput = new Uint32Array(4);
  const governanceAllowed = governanceStore.evaluatePolicyHooks(
    {
      policyId: 1,
      expectedOwnerVersion: governanceStore.ownerVersion,
      tick: 320,
      hookKindMask: M5_GOVERNANCE_HOOK_MASK_ALL,
      minLegitimacyScore: 500,
      blockedRiskFlags: 0,
      candidateCap: 4,
      scanCap: 4,
    },
    hookOutput,
  );
  mustOk(governanceAllowed);
  const governanceBlocked = governanceStore.evaluatePolicyHooks(
    {
      policyId: 1,
      expectedOwnerVersion: governanceStore.ownerVersion,
      tick: 320,
      hookKindMask: M5_GOVERNANCE_HOOK_MASK_ALL,
      minLegitimacyScore: 500,
      blockedRiskFlags: M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
      candidateCap: 4,
      scanCap: 4,
    },
    hookOutput,
  );
  mustOk(governanceBlocked);

  return {
    factionQuery,
    factionSelectedFactIds: copySelected(factOutput, factionQuery.selectedCount),
    factionMetrics: factionStore.createMetrics(),
    governanceAllowed,
    governanceBlocked,
    governanceSelectedHookIds: copySelected(hookOutput, governanceAllowed.selectedCount),
    governanceMetrics: governanceStore.createMetrics(),
  };
}

function runSeasonEvidence(
  authoritativeScenarioSeed: string,
  factionGovernance: M5AlphaFactionGovernanceEvidence,
): M5AlphaSeasonEvidence {
  const store = createM5SeasonEventPoolStore({
    candidateCapacity: 12,
    cooldownCapacity: 6,
    recoveryWindowCapacity: 4,
    preconditionFailureCapacity: 4,
  });
  const basis = {
    anomalyOwnerVersion: 9,
    factionOwnerVersion: factionGovernance.factionMetrics.ownerVersion,
    governanceOwnerVersion: factionGovernance.governanceMetrics.ownerVersion,
    seasonOwnerVersion: 13,
    resourceOwnerVersion: 17,
    recoveryBasisVersion: 19,
  };
  mustOk(
    store.registerCandidate(
      createSeasonCandidate({
        candidateId: 0,
        theme: M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE,
        preconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
        score: 950,
        priority: 100,
        cooldownKey: 1,
        cooldownTicks: 100,
        freshnessWindowTicks: 120,
        stableSequence: 1,
        ...basis,
      }),
    ),
  );
  mustOk(
    store.registerCandidate(
      createSeasonCandidate({
        candidateId: 1,
        theme: M5_SEASON_EVENT_THEME_REGISTRATION_PRESSURE,
        preconditionMask: M5_SEASON_PRECONDITION_REGISTRATION_PRESSURE,
        score: 850,
        stableSequence: 2,
        ...basis,
      }),
    ),
  );
  mustOk(
    store.registerCandidate(
      createSeasonCandidate({
        candidateId: 2,
        theme: M5_SEASON_EVENT_THEME_MARKET_NIGHT,
        preconditionMask: M5_SEASON_PRECONDITION_MARKET_NIGHT,
        score: 760,
        stableSequence: 3,
        ...basis,
      }),
    ),
  );
  mustOk(
    store.registerCandidate(
      createSeasonCandidate({
        candidateId: 3,
        theme: M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE,
        preconditionMask: M5_SEASON_PRECONDITION_BRIDGE_ROUTE,
        score: 740,
        stableSequence: 4,
        ...basis,
      }),
    ),
  );
  mustOk(
    store.registerCandidate(
      createSeasonCandidate({
        candidateId: 4,
        theme: M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK,
        preconditionMask: M5_SEASON_PRECONDITION_ARCHIVE_RISK,
        score: 710,
        stableSequence: 5,
        ...basis,
      }),
    ),
  );
  mustOk(
    store.registerCandidate(
      createRecoveryCandidate({
        candidateId: 5,
        recoveryType: M5_SEASON_RECOVERY_RESOURCE,
        preconditionMask: M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
        score: 900,
        stableSequence: 6,
        ...basis,
      }),
    ),
  );
  mustOk(
    store.registerCandidate(
      createRecoveryCandidate({
        candidateId: 6,
        recoveryType: M5_SEASON_RECOVERY_BRIDGE_ROUTE,
        commandKind: M5_SEASON_COMMAND_BRIDGE_ROUTE_OPPORTUNITY,
        score: 760,
        stableSequence: 7,
        ...basis,
      }),
    ),
  );

  const output = new Uint32Array(4);
  const streams = createNamedRandomStreams({ seed: authoritativeScenarioSeed });
  const preconditionFailure = store.selectEvent(
    {
      poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
      expectedPoolVersion: store.ownerVersion,
      tick: 400,
      satisfiedPreconditionMask: 0,
      candidateCap: 4,
      selectedCap: 4,
      streamName: M5_ALPHA_STREAM_NAME,
      randomStreams: streams,
    },
    output,
  );
  mustOk(preconditionFailure);
  const latestFailure = store.readPreconditionFailure(0);
  if (latestFailure === undefined) {
    throw new Error("M5 season event pool did not record precondition failure");
  }
  const incidentSelection = store.selectEvent(
    {
      poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
      expectedPoolVersion: store.ownerVersion,
      tick: 430,
      satisfiedPreconditionMask: M5_SEASON_PRECONDITION_ALL,
      candidateCap: 1,
      selectedCap: 1,
      streamName: M5_ALPHA_STREAM_NAME,
      randomStreams: streams,
    },
    output,
  );
  mustOk(incidentSelection);
  const incidentCandidate = requireSeasonCandidateId(incidentSelection);
  const incidentView = store.readCandidate(incidentCandidate);
  if (incidentView === undefined) {
    throw new Error("M5 season incident selection did not expose a candidate view");
  }
  const cooldownSelection = store.selectEvent(
    {
      poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
      expectedPoolVersion: store.ownerVersion,
      tick: 440,
      satisfiedPreconditionMask: M5_SEASON_PRECONDITION_ALL,
      candidateCap: 1,
      selectedCap: 1,
      streamName: M5_ALPHA_STREAM_NAME,
      randomStreams: streams,
    },
    output,
  );
  mustOk(cooldownSelection);
  mustOk(
    store.openRecoveryWindow({
      windowId: 0,
      recoveryType: M5_SEASON_RECOVERY_RESOURCE,
      startTick: 450,
      endTick: 900,
      sourceCandidateVersion: incidentView.candidateVersion,
    }),
  );
  const recoveryPreconditionFailure = store.selectEvent(
    {
      poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
      expectedPoolVersion: store.ownerVersion,
      tick: 460,
      satisfiedPreconditionMask: 0,
      candidateCap: 4,
      selectedCap: 4,
      streamName: M5_ALPHA_STREAM_NAME,
      randomStreams: streams,
    },
    output,
  );
  mustOk(recoveryPreconditionFailure);
  const recoverySelection = store.selectEvent(
    {
      poolId: M5_SEASON_EVENT_POOL_FIRST_SEASON,
      expectedPoolVersion: store.ownerVersion,
      tick: 470,
      satisfiedPreconditionMask: M5_SEASON_PRECONDITION_ALL,
      candidateCap: 4,
      selectedCap: 4,
      streamName: M5_ALPHA_STREAM_NAME,
      randomStreams: streams,
    },
    output,
  );
  mustOk(recoverySelection);

  return {
    preconditionFailure,
    latestPreconditionFailureReason: latestFailure.reason,
    incidentSelection,
    cooldownSelection,
    recoveryPreconditionFailure,
    recoverySelection,
    metrics: store.createMetrics(),
  };
}

function createStrategyPaths(
  roster: M5AlphaRosterEvidence,
  thirdKnock: M5AlphaThirdKnockEvidence,
  oldBridge: M5AlphaOldBridgeEvidence,
  factionGovernance: M5AlphaFactionGovernanceEvidence,
  season: M5AlphaSeasonEvidence,
): readonly M5AlphaStrategyPathEvidence[] {
  return [
    {
      pathId: "evidence_first",
      primaryCommand: M5_SEASON_COMMAND_SCHEDULE_EVENT,
      anomalyDefId: roster.borrowedShadowDefId,
      selectedEventCandidateId: selectedCandidateIdOrNone(season.incidentSelection),
      selectedOwnerCount: roster.definitionCount,
      nonCombatResolution: true,
      structuredReason: "m5.alpha.borrowed_shadow.rostered",
    },
    {
      pathId: "lamp_patrol",
      primaryCommand: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
      anomalyDefId: roster.thirdKnockDefId,
      selectedEventCandidateId: selectedCandidateIdOrNone(season.recoverySelection),
      selectedOwnerCount: thirdKnock.lowRiskEvidenceCount,
      nonCombatResolution: thirdKnock.terminalReason === M5_THIRD_KNOCK_TERMINAL_CONTAINED,
      structuredReason: "m5.alpha.third_knock.non_combat_contained",
    },
    {
      pathId: "faction_negotiation",
      primaryCommand: M5_SEASON_COMMAND_BRIDGE_ROUTE_OPPORTUNITY,
      anomalyDefId: roster.oldBridgeDefId,
      selectedEventCandidateId: oldBridge.selectedCandidateId,
      selectedOwnerCount: factionGovernance.factionMetrics.activeFactCount,
      nonCombatResolution: oldBridge.terminalReason === M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
      structuredReason: "m5.alpha.old_bridge.reciprocity_resolved",
    },
    {
      pathId: "conservative_governance",
      primaryCommand: M5_SEASON_COMMAND_REGISTRATION_OPPORTUNITY,
      anomalyDefId: roster.thirdKnockDefId,
      selectedEventCandidateId: selectedCandidateIdOrNone(season.preconditionFailure),
      selectedOwnerCount: factionGovernance.governanceMetrics.activeHookCount,
      nonCombatResolution: true,
      structuredReason: "m5.alpha.governance_policy.risk_blocked",
    },
  ];
}

function createM4RegressionEvidence(): M5AlphaRegressionEvidence {
  const summary = runM4CoreVerticalSliceScenario({
    seed: "4",
    ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS,
  });
  if (
    summary.contentHash !== "0x698f2c41" ||
    summary.commandStreamHash !== "0x538d0e43" ||
    summary.finalWorldHash !== "0xc201a925" ||
    summary.readModelHash !== "0xce261d9d"
  ) {
    throw new Error("M4 regression evidence changed before M5 integration");
  }
  return {
    scenarioId: "m4.core_vertical_slice.borrowed_shadow_lamps.v1",
    requestedSeed: "4",
    authoritativeScenarioSeed: summary.authoritativeScenarioSeed,
    contentHash: "0x698f2c41",
    commandStreamHash: "0x538d0e43",
    finalWorldHash: "0xc201a925",
    readModelHash: "0xce261d9d",
    unchanged: true,
  };
}

function createStopSigns(): M5AlphaStopSigns {
  return {
    saveReplayImplemented: false,
    workerProjectionImplemented: false,
    benchmarkBaselineUpdated: false,
    m6Created: false,
    nextTasks: ["WM-0081", "WM-0082", "WM-0083"],
  };
}

function createBorrowedShadowBasis(candidateId: number): {
  readonly candidateId: number;
  readonly targetActorId: number;
  readonly lampId: number;
  readonly lampGapScore: number;
  readonly humanClaim: number;
  readonly lampGapSourceVersion: number;
  readonly lampGapIndexVersion: number;
  readonly identityCaseId: number;
  readonly identityHypothesisId: number;
  readonly identitySupportTier: number;
  readonly identitySupportScore: number;
  readonly identityIndependentClassCount: number;
  readonly identityConfirmed: number;
  readonly evidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly obligationDuePressure: number;
  readonly townRuleOwnerVersion: number;
  readonly nightWatchPolicyKnown: number;
} {
  return {
    candidateId,
    targetActorId: 1000 + candidateId,
    lampId: 2000 + candidateId,
    lampGapScore: M4_BORROWED_SHADOW_MIN_GAP_SCORE + 20,
    humanClaim: 520,
    lampGapSourceVersion: 11,
    lampGapIndexVersion: 12,
    identityCaseId: 3000 + candidateId,
    identityHypothesisId: 4000 + candidateId,
    identitySupportTier: M4_EVIDENCE_TIER_CONFIRMED,
    identitySupportScore: 720,
    identityIndependentClassCount: 4,
    identityConfirmed: candidateId === 0 ? 1 : 0,
    evidenceOwnerVersion: 13,
    obligationOwnerVersion: 14,
    obligationDuePressure: 330,
    townRuleOwnerVersion: 15,
    nightWatchPolicyKnown: 1,
  };
}

function createThirdKnockBasis(
  candidateId: number,
  contentHash: string,
  overrides: Partial<M5ThirdKnockActivationBasis> = {},
): M5ThirdKnockActivationBasis {
  return {
    candidateId,
    defIndex: 1,
    rosterVersion: M5_ALPHA_ROSTER_VERSION,
    contentManifestHash: contentHash,
    residentActorId: 1100 + candidateId,
    guestActorId: 1200 + candidateId,
    doorId: 1300 + candidateId,
    thresholdId: 1400 + candidateId,
    chronicleCaseId: 1500 + candidateId,
    chronicleHypothesisId: 1600 + candidateId,
    knockCount: 3,
    answeredThirdKnock: 1,
    thresholdBasisVersion: 21,
    thresholdMarkCount: 2,
    chronicleEvidenceOwnerVersion: 22,
    chronicleSupportScore: 620,
    chronicleIndependentClassCount: 4,
    townRuleOwnerVersion: 23,
    knowsConfirmedRule: 0,
    temporaryPolicyActive: 0,
    obligationOwnerVersion: 24,
    obligationPressure: 340,
    guesthousePolicyVersion: 25,
    lodgingRegisterVersion: 26,
    lodgingRegisterMismatch: 1,
    witnessDisagreementScore: 470,
    priorKnockWitnessCount: 2,
    invitationDebtScore: 720,
    priority: 0,
    stableOwnerId: 1700 + candidateId,
    stableSequence: candidateId,
    ...overrides,
  };
}

function createOldBridgeBasis(
  candidateId: number,
  contentHash: string,
  overrides: Partial<M5OldBridgeActivationBasis> = {},
): M5OldBridgeActivationBasis {
  return {
    candidateId,
    defIndex: 2,
    rosterVersion: M5_ALPHA_ROSTER_VERSION,
    contentManifestHash: contentHash,
    crossingActorId: 2100 + candidateId,
    guestActorId: 2200 + candidateId,
    bridgeId: 2300,
    routeId: 2400 + candidateId,
    bridgeWindowId: 2500,
    seasonWindowId: 2600,
    bridgeWindowActive: 1,
    routePassable: 1,
    routeBasisVersion: 31,
    routeDelayScore: 430,
    bridgeLedgerVersion: 32,
    bridgeLedgerEntryId: 2700 + candidateId,
    bridgeLedgerMismatch: 1,
    preparedItemStackId: M5_OLD_BRIDGE_NONE,
    preparedItemDefId: 2800,
    preparedItemQuantity: 0,
    preparedForActorId: 2900 + candidateId,
    preparedItemOwnerVersion: 33,
    logisticsIndexVersion: 34,
    chronicleCaseId: 3000 + candidateId,
    chronicleHypothesisId: 3100 + candidateId,
    chronicleEvidenceOwnerVersion: 35,
    obligationOwnerVersion: 36,
    obligationId: 3200 + candidateId,
    obligationPressure: 360,
    factionFactOwnerVersion: 37,
    factionPressure: 240,
    seasonOwnerVersion: 38,
    oldFamilyRecordVersion: 39,
    merchantTestimonyScore: 480,
    oldFamilyOralRecordScore: 520,
    preparedItemScore: 0,
    reciprocityDebtScore: 760,
    selfServingToll: 0,
    priority: 0,
    stableOwnerId: 3300 + candidateId,
    stableSequence: candidateId,
    ...overrides,
  };
}

function createFactionFact(overrides: Partial<M5FactionFactInput> = {}): M5FactionFactInput {
  return {
    factId: 0,
    factionId: 1,
    subjectId: 20,
    kind: M5_FACTION_FACT_KIND_LEGAL_STANCE,
    value: 640,
    sourceEventId: 100,
    sourceOwnerVersion: 5,
    chronicleOwnerVersion: 7,
    obligationOwnerVersion: 9,
    tick: 300,
    priority: 500,
    stableOwnerId: 1,
    stableSequence: 1,
    ...overrides,
  };
}

function createGovernanceHook(
  overrides: Partial<M5GovernanceHookInput> = {},
): M5GovernanceHookInput {
  return {
    hookId: 0,
    policyId: 1,
    hookKind: M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
    authorityActorId: 10,
    councilPostId: M5_FACTION_GOVERNANCE_NONE,
    temporaryPolicyId: M5_FACTION_GOVERNANCE_NONE,
    enforcementCapacity: 200,
    legitimacySourceId: 30,
    legitimacyScore: 220,
    riskFlags: 0,
    townRuleOwnerVersion: 11,
    obligationOwnerVersion: 13,
    chronicleOwnerVersion: 17,
    sourceEventId: 200,
    sourceOwnerVersion: 19,
    startsAtTick: 10,
    expiresAtTick: 10_000,
    priority: 500,
    stableOwnerId: 1,
    stableSequence: 1,
    ...overrides,
  };
}

function createSeasonCandidate(
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
    expiresTick: 2_000,
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
  return createSeasonCandidate({
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

function createCommandStream(): readonly M5AlphaCommandEntry[] {
  return [
    command(0, 0, "m5.alpha.scenario.initialized", 1, 1),
    command(1, 1, "m5.alpha.content_catalog.accepted", M5_ALPHA_DEFINITION_COUNT, 1),
    command(2, 2, "m5.alpha.anomaly_roster.loaded", M5_ALPHA_ROSTER_VERSION, 3),
    command(80, 3, "m5.alpha.borrowed_shadow.rostered", 0, 10),
    command(120, 4, "m5.alpha.third_knock.non_combat_contained", 0, 1100),
    command(220, 5, "m5.alpha.old_bridge.reciprocity_resolved", 1, 2300),
    command(320, 6, "m5.alpha.faction_strategy.selected", 1, 20),
    command(330, 7, "m5.alpha.governance_policy.allowed", 1, 10),
    command(
      340,
      8,
      "m5.alpha.governance_policy.risk_blocked",
      1,
      M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
    ),
    command(
      400,
      9,
      "m5.alpha.season.precondition_failed",
      0,
      M5_SEASON_PRECONDITION_RESOURCE_PRESSURE,
    ),
    command(430, 10, "m5.alpha.season.incident_selected", 0, M5_SEASON_COMMAND_SCHEDULE_EVENT),
    command(440, 11, "m5.alpha.season.cooldown_recorded", 0, M5_SEASON_COMMAND_SCHEDULE_EVENT),
    command(
      470,
      12,
      "m5.alpha.season.recovery_selected",
      5,
      M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
    ),
    command(600, 13, "m5.alpha.m4_regression.preserved", 4, 36_000),
    command(700, 14, "m5.alpha.downstream.stop_signs.recorded", 81, 83),
  ];
}

function command(
  tick: Tick,
  sequence: number,
  reason: M5AlphaContentScenarioReason,
  subjectId: number,
  targetId: number,
): M5AlphaCommandEntry {
  return { tick, sequence, reason, subjectId, targetId };
}

function createCommandStreamHash(
  commands: readonly M5AlphaCommandEntry[],
  authoritativeScenarioSeed: string,
): number {
  let hash = hashStringToUint32(M5_ALPHA_CONTENT_SCENARIO_ID);
  hash = mixUint32(hash, hashStringToUint32(authoritativeScenarioSeed));
  for (const entry of commands) {
    hash = mixUint32(hash, entry.tick);
    hash = mixUint32(hash, entry.sequence);
    hash = mixUint32(hash, hashStringToUint32(entry.reason));
    hash = mixUint32(hash, entry.subjectId);
    hash = mixUint32(hash, entry.targetId);
  }
  return hash;
}

function createFinalWorldHash(
  finalTick: Tick,
  authoritativeScenarioSeed: string,
  run: ScenarioRun,
): string {
  return formatCanonicalWorldHash({
    fields: [
      field("scenario", M5_ALPHA_CONTENT_SCENARIO_ID),
      field("seed", authoritativeScenarioSeed),
      field("finalTick", finalTick),
      field("contentHash", run.contentCatalog.contentHash),
      field("rosterDefinitions", run.roster.definitionCount),
      field("thirdKnockResolved", run.thirdKnock.metrics.resolvedCrisisCount),
      field("thirdKnockLowRiskEvidence", run.thirdKnock.metrics.lowRiskEvidenceCount),
      field("oldBridgeResolved", run.oldBridge.metrics.resolvedCrisisCount),
      field("oldBridgeCleanupCapHits", run.oldBridge.metrics.terminalCleanupCapHitCount),
      field("factionFacts", run.factionGovernance.factionMetrics.activeFactCount),
      field("governanceHooks", run.factionGovernance.governanceMetrics.activeHookCount),
      field("seasonSelections", run.season.metrics.selectionCount),
      field("seasonPreconditionFailures", run.season.metrics.preconditionFailureCount),
      field("m4FinalWorldHash", run.m4Regression.finalWorldHash),
      field("stopSignM6Created", false),
    ],
    randomStreams: [],
    queuedCommands: canonicalCommands(createCommandStream()),
  });
}

function createReadModelHash(
  finalTick: Tick,
  authoritativeScenarioSeed: string,
  run: ScenarioRun,
): string {
  return formatCanonicalWorldHash({
    fields: [
      field("scenario", M5_ALPHA_CONTENT_SCENARIO_ID),
      field("seed", authoritativeScenarioSeed),
      field("finalTick", finalTick),
      field("contentHash", run.contentCatalog.contentHash),
      field("catalogEntries", run.contentCatalog.catalogEntryCount),
      field("blockedEntries", run.contentCatalog.blockedCatalogEntryCount),
      field("borrowedEvidenceKinds", run.borrowedShadow.evidenceKinds.length),
      field("thirdKnockReviewReason", run.thirdKnock.review.reason),
      field("oldBridgeReviewReason", run.oldBridge.review.reason),
      field("factionQueryReason", reasonOf(run.factionGovernance.factionQuery)),
      field("governanceBlockedReason", reasonOf(run.factionGovernance.governanceBlocked)),
      field("seasonIncidentReason", reasonOf(run.season.incidentSelection)),
      field("seasonRecoveryReason", reasonOf(run.season.recoverySelection)),
      field("strategyPathCount", run.strategyPaths.length),
      field("m4ReadModelHash", run.m4Regression.readModelHash),
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function canonicalCommands(
  commands: readonly M5AlphaCommandEntry[],
): readonly { readonly tick: Tick; readonly sequence: number; readonly commandHash: number }[] {
  const output: { tick: Tick; sequence: number; commandHash: number }[] = [];
  for (const entry of commands) {
    let hash = hashStringToUint32(entry.reason);
    hash = mixUint32(hash, entry.subjectId);
    hash = mixUint32(hash, entry.targetId);
    output.push({ tick: entry.tick, sequence: entry.sequence, commandHash: hash });
  }
  return output;
}

function createContentManifestHash(): string {
  const validated = validateM5ContentPack(createM5AlphaContentCatalogPack());
  if (!validated.ok || validated.pack === undefined) {
    throw new Error("WM-0080 expected the WM-0079 alpha content pack to validate");
  }

  const definitions = createCompiledContentDefinitions(validated.pack.fixture.definitions);
  const hashDefinitions: CompiledContentHashDefinition[] = [];
  for (const definition of definitions) {
    hashDefinitions.push({
      defIndex: definition.defIndex,
      id: definition.id,
      kind: definition.kind,
      schemaVersion: definition.schemaVersion,
      references: definition.references,
      tags: definition.tags,
    });
  }

  return formatUint32Hex(
    hashStringToUint32(
      stableSerialize({
        manifest: createHashManifest(validated.pack.manifest),
        definitions: hashDefinitions,
        counters: createHashCounters(validated.pack.counters),
      }),
    ),
  );
}

interface CompiledContentDefinition {
  readonly defIndex: number;
  readonly id: string;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly tags: readonly string[];
  readonly references: readonly string[];
}

interface CompiledContentHashDefinition {
  readonly defIndex: number;
  readonly id: string;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly references: readonly string[];
  readonly tags: readonly string[];
}

function createCompiledContentDefinitions(
  definitions: readonly ValidatedDefinitionFile[],
): readonly CompiledContentDefinition[] {
  const sorted = sortedDefinitionsById(definitions);
  const compiled: CompiledContentDefinition[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const definition = sorted[index];
    if (definition === undefined) continue;
    compiled.push({
      defIndex: index,
      id: definition.id,
      kind: definition.kind,
      schemaVersion: definition.schemaVersion,
      labelKey: definition.labelKey,
      descriptionKey: definition.descriptionKey,
      tags: copyStrings(definition.tags),
      references: copyReferenceIds(definition.references),
    });
  }
  return compiled;
}

function createHashManifest(manifest: M5ContentManifest): M5ContentManifest {
  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    version: manifest.version,
    displayName: manifest.displayName,
    capabilities: copyStrings(manifest.capabilities),
    contentKinds: copyStrings(manifest.contentKinds),
    locales: copyStrings(manifest.locales),
    dependencies: copyStrings(manifest.dependencies),
    maxFileBytes: manifest.maxFileBytes,
    maxTotalBytes: manifest.maxTotalBytes,
  };
}

function createHashCounters(counters: M5ContentValidationCounters): M5ContentValidationCounters {
  return {
    fileCount: counters.fileCount,
    definitionCount: counters.definitionCount,
    localeCount: counters.localeCount,
    patchCount: counters.patchCount,
    byteCount: counters.byteCount,
    anomalyCount: counters.anomalyCount,
    factionHookCount: counters.factionHookCount,
    governanceHookCount: counters.governanceHookCount,
    seasonEventCount: counters.seasonEventCount,
    catalogEntryCount: counters.catalogEntryCount,
    diagnosticCount: counters.diagnosticCount,
  };
}

function sortedDefinitionsById(
  definitions: readonly ValidatedDefinitionFile[],
): readonly ValidatedDefinitionFile[] {
  const sorted: ValidatedDefinitionFile[] = [];
  for (const definition of definitions) {
    sorted.splice(findDefinitionInsertIndex(sorted, definition.id), 0, definition);
  }
  return sorted;
}

function findDefinitionInsertIndex(
  definitions: readonly ValidatedDefinitionFile[],
  id: string,
): number {
  for (let index = 0; index < definitions.length; index += 1) {
    const existing = definitions[index];
    if (existing !== undefined && compareStrings(id, existing.id) < 0) return index;
  }
  return definitions.length;
}

function copyReferenceIds(references: readonly { readonly id: string }[]): readonly string[] {
  const ids: string[] = [];
  for (const reference of references) {
    ids.push(reference.id);
  }
  return ids;
}

function copyStrings<T extends string>(values: readonly T[]): readonly T[] {
  const copy: T[] = [];
  for (const value of values) {
    copy.push(value);
  }
  return copy;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return stableSerializeArray(value);
  }

  if (isRecord(value)) {
    return stableSerializeRecord(value);
  }

  if (value === undefined || typeof value === "function") {
    return "null";
  }
  return JSON.stringify(value);
}

function stableSerializeArray(values: readonly unknown[]): string {
  let text = "[";
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) text += ",";
    text += stableSerialize(values[index]);
  }
  return `${text}]`;
}

function stableSerializeRecord(value: Readonly<Record<string, unknown>>): string {
  const keys = sortedRecordKeys(value);
  let text = "{";
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (index > 0) text += ",";
    text += `${JSON.stringify(key)}:${stableSerialize(value[key])}`;
  }
  return `${text}}`;
}

function sortedRecordKeys(value: Readonly<Record<string, unknown>>): readonly string[] {
  const keys: string[] = [];
  for (const key of Object.keys(value)) {
    keys.splice(findStringInsertIndex(keys, key), 0, key);
  }
  return keys;
}

function findStringInsertIndex(values: readonly string[], value: string): number {
  for (let index = 0; index < values.length; index += 1) {
    const existing = values[index];
    if (existing !== undefined && compareStrings(value, existing) < 0) return index;
  }
  return values.length;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function selectedCandidateIdOrNone(result: M5SeasonEventSelectionResult): number {
  return result.ok ? result.selectedCandidateId : M5_SEASON_EVENT_NONE;
}

function requireSeasonCandidateId(result: M5SeasonEventSelectionResult): number {
  if (!result.ok || result.selectedCandidateId === M5_SEASON_EVENT_NONE) {
    throw new Error("expected a selected M5 season event candidate");
  }
  return result.selectedCandidateId;
}

function copySelected(output: Uint32Array, selectedCount: number): readonly number[] {
  const selected: number[] = [];
  for (let index = 0; index < selectedCount; index += 1) {
    selected.push(output[index] ?? 0);
  }
  return selected;
}

function field(name: string, value: string | number | boolean): CanonicalWorldField {
  return { name, value };
}

function reasonOf(result: { readonly reason: string }): string {
  return result.reason;
}

function requireDefinition(view: M5AnomalyDefinitionView | undefined): M5AnomalyDefinitionView {
  if (view === undefined) throw new Error("expected M5 anomaly definition");
  return view;
}

function mustOk<T extends { readonly ok: true } | { readonly ok: false; readonly reason: string }>(
  result: T,
): asserts result is Extract<T, { readonly ok: true }> {
  if (!result.ok) throw new Error(result.reason);
}
