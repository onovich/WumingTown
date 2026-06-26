import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import { createNamedRandomStreams, type NamedRandomStreams } from "./deterministic-rng";
import {
  M3_ORDINARY_LIFE_PRIMARY_SEED,
  M3_ORDINARY_LIFE_SCENARIO_ID,
} from "./m3-ordinary-life-scenario";
import { createM4BorrowedShadowCrisisStore } from "./m4-borrowed-shadow-crisis";
import {
  M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
  M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME,
  M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
  M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH,
  M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
  M4_BORROWED_SHADOW_TERMINAL_HARM,
  type M4BorrowedShadowReason,
  type M4BorrowedShadowCrisisView,
} from "./m4-borrowed-shadow-types";
import { createM4ChronicleCaseFileStore } from "./m4-chronicle-case-file";
import { createM4EvidenceReasonTraceStore } from "./m4-chronicle-reason-trace";
import {
  M4_EVIDENCE_CLASS_OBSERVATION,
  M4_EVIDENCE_CLASS_SOURCE,
  M4_EVIDENCE_CLASS_TESTIMONY,
  M4_EVIDENCE_CLASS_TRACE,
  M4_EVIDENCE_SOURCE_ARCHIVE,
  M4_EVIDENCE_SOURCE_PERSON,
  M4_EVIDENCE_SOURCE_SCENE,
  M4_EVIDENCE_TIER_CONFIRMED,
  M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
  M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
} from "./m4-chronicle-types";
import {
  M4_DIRECTOR_CANDIDATE_INCIDENT,
  M4_DIRECTOR_CANDIDATE_RECOVERY,
  M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
  M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
  M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
  M4_DIRECTOR_RECOVERY_NONE,
  M4_DIRECTOR_THEME_CRISIS,
  M4_DIRECTOR_THEME_EVIDENCE,
  M4_DIRECTOR_THEME_LAMP,
} from "./m4-director-types";
import { createM4DirectorPressureStore } from "./m4-director-pressure-store";
import { createM4EvidenceFactStore } from "./m4-evidence-facts";
import { createM4KnowledgeDisseminationStore } from "./m4-evidence-dissemination";
import { M4_LAMP_GAP_DEFAULT_CANDIDATE_CAP, createM4LampGapIndex } from "./m4-lamp-gap-index";
import {
  M4_LAMP_MAINTENANCE_NEEDS_FUEL,
  M4_LAMP_MAINTENANCE_OK,
  M4_LAMP_TAG_BOUNDARY,
  M4_LAMP_TAG_ROAD,
  createM4LampNetworkStore,
  type M4LampNetworkStore,
} from "./m4-lamp-network";
import {
  M4_OBLIGATION_ACTION_CONFIRM_NAME,
  M4_OBLIGATION_ACTION_DELIVER_OIL,
  M4_OBLIGATION_ACTION_GIVE_TESTIMONY,
  M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY,
  M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY,
  M4_OBLIGATION_CONDITION_NAME_CONFIRMATION,
  M4_OBLIGATION_INHERITANCE_PERSONAL,
  M4_OBLIGATION_INHERITANCE_ROLE,
  M4_OBLIGATION_TYPE_IDENTITY,
  M4_OBLIGATION_TYPE_MATERIAL,
  M4_OBLIGATION_TYPE_WITNESS,
  M4_OBLIGATION_VIOLATION_EVIDENCE_WITHHELD,
  M4_OBLIGATION_VIOLATION_IDENTITY_UNCONFIRMED,
  M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK,
  M4_OBLIGATION_VISIBILITY_PUBLIC,
  M4_OBLIGATION_VISIBILITY_ROLE,
} from "./m4-obligation-types";
import { createM4ObligationStore } from "./m4-obligation-store";
import {
  M4_TOWN_RULE_ACTION_CONFIRM_NAME,
  M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
  M4_TOWN_RULE_ENFORCEMENT_KEEPER,
  M4_TOWN_RULE_ENFORCEMENT_NIGHT_WATCH,
  M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY,
  M4_TOWN_RULE_EXCEPTION_EMERGENCY,
  M4_TOWN_RULE_LEGITIMACY_CHRONICLE_CONFIRMED,
  M4_TOWN_RULE_LEGITIMACY_PLAYER_TEMPORARY,
  M4_TOWN_RULE_PENALTY_DENY_ENTRY,
  M4_TOWN_RULE_PENALTY_WARNING,
  M4_TOWN_RULE_SCOPE_RESIDENT,
  M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
  M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
} from "./m4-town-rule-types";
import { createM4TownRuleStore } from "./m4-town-rule-store";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";

export const M4_CORE_VERTICAL_SLICE_SCENARIO_ID = "m4.core_vertical_slice.borrowed_shadow_lamps.v1";
export const M4_CORE_VERTICAL_SLICE_ALIAS = "m4-core-vertical-slice";
export const M4_CORE_VERTICAL_SLICE_TRACE_CAPACITY = 32;
export const M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS = 36_000;

export type M4CoreVerticalSliceReason =
  | "m4.scenario.initialized"
  | "m4.lamp_gap.candidate_selected"
  | "m4.chronicle.identity_rule_confirmed"
  | "m4.obligation.lamp_oil_fulfilled"
  | "m4.town_rule.name_confirmed"
  | "m4.town_rule.night_knock_complied"
  | "m4.borrowed_shadow.activation_prevented"
  | "m4.borrowed_shadow.low_risk_evidence_before_harm"
  | "m4.borrowed_shadow.contained_non_combat"
  | "m4.borrowed_shadow.accident_review_terminal"
  | "m4.director.recovery_window_selected"
  | "m4.m3_regression.baseline_preserved";

export interface M4CoreVerticalSliceScenarioOptions {
  readonly seed: string;
  readonly ticks: Tick;
}

export interface M4CoreDawnReviewRow {
  readonly rowId: number;
  readonly branchId: number;
  readonly tick: Tick;
  readonly sourceKind: number;
  readonly sourceId: number;
  readonly ownerVersion: number;
  readonly reason: M4CoreVerticalSliceReason;
}

export interface M4CoreBoundedReadEvidence {
  readonly lampGapVisited: number;
  readonly lampGapCandidateCap: number;
  readonly chronicleEvidenceVisited: number;
  readonly chronicleEvidenceCandidateCap: number;
  readonly obligationVisited: number;
  readonly obligationScanCap: number;
  readonly townRuleVisited: number;
  readonly townRuleScanCap: number;
  readonly crisisCandidateVisited: number;
  readonly crisisCandidateCap: number;
  readonly directorVisited: number;
  readonly directorCandidateCap: number;
}

export interface M4CorePathEvidence {
  readonly active: boolean;
  readonly branchId: number;
  readonly crisisId: number;
  readonly selectedCandidateId: number;
  readonly activationTick: Tick;
  readonly identityConfirmedTick: Tick;
  readonly obligationFulfilledTick: Tick;
  readonly townRuleDecisionTick: Tick;
  readonly activationBasis: M4CoreActivationBasisEvidence;
  readonly supportTier: number;
  readonly independentEvidenceClassCount: number;
  readonly lowRiskEvidenceCount: number;
  readonly evidenceBeforeIrreversibleHarm: boolean;
  readonly terminalReason: number;
  readonly reason: M4BorrowedShadowReason;
  readonly dawnReviewRowId: number;
}

export interface M4CoreActivationBasisEvidence {
  readonly candidateId: number;
  readonly identityConfirmed: number;
  readonly identitySupportTier: number;
  readonly identityIndependentClassCount: number;
  readonly evidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly townRuleOwnerVersion: number;
}

export interface M4CoreScenarioInvariantCounters {
  readonly preventionPathCount: number;
  readonly containmentPathCount: number;
  readonly failurePathCount: number;
  readonly lowRiskEvidenceBeforeHarmCount: number;
  readonly dawnReviewSourceRowCount: number;
  readonly directFactMutationByDirectorCount: number;
  readonly m0ToM3RegressionCount: number;
}

export interface M4CoreVerticalSlicePerformanceMetrics {
  readonly lampActiveCount: number;
  readonly lampGroupCount: number;
  readonly lampDirtyBacklogPeak: number;
  readonly lampDirtyBacklogFinal: number;
  readonly lampDirtyDrainCount: number;
  readonly lampDirtyDrainedKeyCount: number;
  readonly lampNormalTickVisitedLampCount: number;
  readonly lampNormalTickVisitedCellCount: number;
  readonly lampFullMapDiffusionCount: number;
  readonly activeGapCount: number;
  readonly lampGapDirtyBacklogPeak: number;
  readonly lampGapDirtyBacklogFinal: number;
  readonly lampGapRefreshedCount: number;
  readonly evidenceSourceCount: number;
  readonly evidenceRowCount: number;
  readonly evidenceHypothesisCount: number;
  readonly evidenceContradictionCount: number;
  readonly evidenceConfirmedRuleCount: number;
  readonly evidenceSupportCandidateVisits: number;
  readonly evidenceTraceCapacity: number;
  readonly evidenceTraceStoredCount: number;
  readonly evidenceTraceBacklogCount: number;
  readonly disseminationRowCount: number;
  readonly disseminationDirtyBacklogPeak: number;
  readonly disseminationDirtyBacklogFinal: number;
  readonly obligationActiveCount: number;
  readonly obligationDueIndexedCount: number;
  readonly obligationFulfilledCount: number;
  readonly obligationViolatedCount: number;
  readonly obligationDueCandidateVisits: number;
  readonly townRuleActiveCount: number;
  readonly townRuleComplianceIndexedCount: number;
  readonly townRuleComplianceCandidateVisits: number;
  readonly townRuleEnforcementCostTotal: number;
  readonly crisisActiveCandidateCount: number;
  readonly crisisActiveCount: number;
  readonly crisisResolvedCount: number;
  readonly crisisFailedCount: number;
  readonly crisisLowRiskEvidenceCount: number;
  readonly crisisTransitionCount: number;
  readonly crisisCandidateVisits: number;
  readonly crisisTraceStoredCount: number;
  readonly directorPressureSampleCount: number;
  readonly directorIncidentCandidateCount: number;
  readonly directorRecoveryCandidateCount: number;
  readonly directorRecoveryWindowCount: number;
  readonly directorActiveRecoveryWindowId: number;
  readonly directorSelectionCount: number;
  readonly directorCandidateVisits: number;
  readonly directorCooldownWriteCount: number;
  readonly directorTraceStoredCount: number;
  readonly reasonTraceCapacity: number;
  readonly reasonTraceStoredCount: number;
  readonly reasonTraceBacklogCount: number;
}

export interface M4CoreM3RegressionEvidence {
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly requestedSeed: "3";
  readonly authoritativeScenarioSeed: typeof M3_ORDINARY_LIFE_PRIMARY_SEED;
  readonly commandStreamHash: "0x226832d2";
  readonly contentHash: "0xdfe7107e";
  readonly finalWorldHash: "0x7eb81a69";
  readonly readModelHash: "0x82bf87d6";
  readonly activeM4FactCountInM3Baseline: 0;
}

export interface M4CoreVerticalSliceScenarioSummary {
  readonly version: 1;
  readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
  readonly alias: typeof M4_CORE_VERTICAL_SLICE_ALIAS;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly authoritativeScenarioSeed: string;
  readonly finalTick: Tick;
  readonly tickRate: 30;
  readonly contentHash: string;
  readonly commandStreamHash: string;
  readonly finalWorldHash: string;
  readonly readModelHash: string;
  readonly preventionPath: M4CorePathEvidence;
  readonly containmentPath: M4CorePathEvidence;
  readonly failurePath: M4CorePathEvidence;
  readonly boundedReads: M4CoreBoundedReadEvidence;
  readonly invariantCounters: M4CoreScenarioInvariantCounters;
  readonly performanceMetrics: M4CoreVerticalSlicePerformanceMetrics;
  readonly dawnReviewRows: readonly M4CoreDawnReviewRow[];
  readonly m3Regression: M4CoreM3RegressionEvidence;
}

interface ScenarioFixture {
  readonly streams: NamedRandomStreams;
  readonly lamps: M4LampNetworkStore;
  readonly lampGap: ReturnType<typeof createM4LampGapIndex>;
  readonly cases: ReturnType<typeof createM4ChronicleCaseFileStore>;
  readonly evidence: ReturnType<typeof createM4EvidenceFactStore>;
  readonly evidenceTrace: ReturnType<typeof createM4EvidenceReasonTraceStore>;
  readonly knowledge: ReturnType<typeof createM4KnowledgeDisseminationStore>;
  readonly obligations: ReturnType<typeof createM4ObligationStore>;
  readonly rules: ReturnType<typeof createM4TownRuleStore>;
  readonly crises: ReturnType<typeof createM4BorrowedShadowCrisisStore>;
  readonly director: ReturnType<typeof createM4DirectorPressureStore>;
  readonly dawnRows: M4CoreDawnReviewRow[];
}

interface ScenarioRunCore {
  readonly preventionFixture: ScenarioFixture;
  readonly containmentFixture: ScenarioFixture;
  readonly failureFixture: ScenarioFixture;
  readonly directorFixture: ScenarioFixture;
  readonly preventionPath: M4CorePathEvidence;
  readonly containmentPath: M4CorePathEvidence;
  readonly failurePath: M4CorePathEvidence;
  readonly boundedReads: M4CoreBoundedReadEvidence;
  readonly dawnRows: readonly M4CoreDawnReviewRow[];
}

interface ScenarioCommand {
  readonly tick: Tick;
  readonly sequence: number;
  readonly kind: M4CoreVerticalSliceReason;
  readonly subjectId: number;
  readonly targetId: number;
}

export function runM4CoreVerticalSliceScenario(
  options: M4CoreVerticalSliceScenarioOptions,
): M4CoreVerticalSliceScenarioSummary {
  if (options.seed.length === 0 || !isSafeTick(options.ticks)) {
    throw new Error("M4 core vertical slice requires a non-empty seed and safe tick count");
  }

  const authoritativeScenarioSeed = deriveM4CoreVerticalSliceScenarioSeed(options.seed);
  const commands = createCommandStream();
  const run = runScenarioOnce(authoritativeScenarioSeed);
  const finalWorldHash = createFinalWorldHash(options.ticks, authoritativeScenarioSeed, run);
  const readModelHash = createReadModelHash(options.ticks, authoritativeScenarioSeed, run);

  return {
    version: 1,
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    alias: M4_CORE_VERTICAL_SLICE_ALIAS,
    seed: authoritativeScenarioSeed,
    requestedSeed: options.seed,
    authoritativeScenarioSeed,
    finalTick: options.ticks,
    tickRate: 30,
    contentHash: formatUint32Hex(createContentHash()),
    commandStreamHash: formatUint32Hex(
      createCommandStreamHash(commands, authoritativeScenarioSeed),
    ),
    finalWorldHash,
    readModelHash,
    preventionPath: run.preventionPath,
    containmentPath: run.containmentPath,
    failurePath: run.failurePath,
    boundedReads: run.boundedReads,
    invariantCounters: createInvariantCounters(run),
    performanceMetrics: createPerformanceMetrics(run),
    dawnReviewRows: run.dawnRows.slice(),
    m3Regression: createM3RegressionEvidence(),
  };
}

export function deriveM4CoreVerticalSliceScenarioSeed(requestedSeed: string): string {
  let hash = hashStringToUint32(M4_CORE_VERTICAL_SLICE_SCENARIO_ID);
  hash = mixUint32(hash, hashStringToUint32(requestedSeed));
  return String(40 + (hash % 60));
}

function runScenarioOnce(authoritativeScenarioSeed: string): ScenarioRunCore {
  const preventionFixture = createFixture(authoritativeScenarioSeed, ROW_BASE_PREVENTION);
  const containmentFixture = createFixture(authoritativeScenarioSeed, ROW_BASE_CONTAINMENT);
  const failureFixture = createFixture(authoritativeScenarioSeed, ROW_BASE_FAILURE);

  const prevention = preparePreventionBranch(preventionFixture);
  const containment = prepareUnconfirmedBranch(containmentFixture);
  const failure = prepareUnconfirmedBranch(failureFixture);

  registerActivationCandidateFromBranch(preventionFixture, 0, 4, 0, prevention.support, 1);
  const preventionCandidates = queryCrisisCandidates(preventionFixture, 1);
  const preventionPath = runPreventionPath(preventionFixture, prevention.support);

  registerActivationCandidateFromBranch(containmentFixture, 1, 4, 1, containment.support, 0);
  const containmentCandidates = queryCrisisCandidates(containmentFixture, 1);
  const containmentPath = runContainmentPath(containmentFixture, containment.support);

  registerActivationCandidateFromBranch(failureFixture, 2, 5, 2, failure.support, 0);
  const failureCandidates = queryCrisisCandidates(failureFixture, 1);
  const failurePath = runFailurePath(failureFixture, failure.support);

  configureDirector(containmentFixture);
  const directorOutput = new Uint32Array(1);
  const director = containmentFixture.director.selectOpportunity(
    {
      tick: 3_200,
      candidateCap: 1,
      selectedCap: 1,
      streamName: "m4.core.recovery",
      randomStreams: containmentFixture.streams,
    },
    directorOutput,
  );
  mustOk(director);
  const directorRow = createDawnRow(
    ROW_BASE_DIRECTOR,
    3_200,
    6,
    director.selectedCandidateId,
    containmentFixture.director.createMetrics().ownerVersion,
    "m4.director.recovery_window_selected",
  );
  const m3RegressionRow = createDawnRow(
    ROW_BASE_M3,
    36_000,
    7,
    3,
    0,
    "m4.m3_regression.baseline_preserved",
  );
  const dawnRows = [
    ...preventionFixture.dawnRows,
    ...containmentFixture.dawnRows,
    ...failureFixture.dawnRows,
    directorRow,
    m3RegressionRow,
  ];

  return {
    preventionFixture,
    containmentFixture,
    failureFixture,
    directorFixture: containmentFixture,
    preventionPath,
    containmentPath,
    failurePath,
    dawnRows,
    boundedReads: {
      lampGapVisited: max3(
        prevention.lampGapVisited,
        containment.lampGapVisited,
        failure.lampGapVisited,
      ),
      lampGapCandidateCap: 2,
      chronicleEvidenceVisited: max3(
        prevention.support.visitedCount,
        containment.support.visitedCount,
        failure.support.visitedCount,
      ),
      chronicleEvidenceCandidateCap: 8,
      obligationVisited: max3(prevention.obligationVisited, containment.obligationVisited, 0),
      obligationScanCap: 4,
      townRuleVisited: max3(prevention.townRuleVisited, containment.townRuleVisited, 0),
      townRuleScanCap: 8,
      crisisCandidateVisited: max3(
        preventionCandidates.visitedCount,
        containmentCandidates.visitedCount,
        failureCandidates.visitedCount,
      ),
      crisisCandidateCap: 1,
      directorVisited: director.visitedCount,
      directorCandidateCap: 1,
    },
  };
}

interface BranchPreparation {
  readonly support: Extract<
    ReturnType<ReturnType<typeof createM4EvidenceFactStore>["evaluateSupport"]>,
    { readonly ok: true }
  >;
  readonly lampGapVisited: number;
  readonly obligationVisited: number;
  readonly townRuleVisited: number;
}

function createFixture(authoritativeScenarioSeed: string, rowBase: number): ScenarioFixture {
  const fixture: ScenarioFixture = {
    streams: createNamedRandomStreams({ seed: authoritativeScenarioSeed }),
    lamps: createM4LampNetworkStore({ lampCapacity: 4, groupCapacity: 2, dirtyCapacity: 8 }),
    lampGap: createM4LampGapIndex({ lampCapacity: 4, groupCapacity: 2, roomCapacity: 16 }),
    cases: createM4ChronicleCaseFileStore({ caseCapacity: 4, versionCapacity: 64 }),
    evidence: createM4EvidenceFactStore({
      caseCapacity: 4,
      sourceCapacity: 8,
      evidenceCapacity: 16,
      hypothesisCapacity: 8,
      contradictionCapacity: 4,
      confirmedRuleCapacity: 8,
    }),
    evidenceTrace: createM4EvidenceReasonTraceStore(8),
    knowledge: createM4KnowledgeDisseminationStore({
      residentCapacity: 8,
      subjectCapacity: 16,
      rowCapacity: 8,
    }),
    obligations: createM4ObligationStore({ obligationCapacity: 8, actorCapacity: 8 }),
    rules: createM4TownRuleStore({ ruleCapacity: 4, subjectCapacity: 8, regionCapacity: 4 }),
    crises: createM4BorrowedShadowCrisisStore({
      candidateCapacity: 4,
      crisisCapacity: 4,
      traceCapacity: M4_CORE_VERTICAL_SLICE_TRACE_CAPACITY,
    }),
    director: createM4DirectorPressureStore({
      sampleCapacity: 4,
      candidateCapacity: 8,
      cooldownCapacity: 8,
      recoveryWindowCapacity: 4,
      traceCapacity: 8,
    }),
    dawnRows: [],
  };

  configureLamps(fixture);
  configureChronicle(fixture);
  configureObligations(fixture);
  configureRules(fixture);
  fixture.dawnRows.push(createDawnRow(rowBase, 0, 0, 0, 0, "m4.scenario.initialized"));
  return fixture;
}

function configureLamps(fixture: ScenarioFixture): void {
  mustOk(fixture.lamps.registerGroup(1));
  mustOk(fixture.lamps.registerLamp(createLamp(0, 1, 7, 840, 700, 0, 700, 40)));
  mustOk(fixture.lamps.registerLamp(createLamp(1, 1, 7, 180, 690, 0, 140, 860)));
  mustOk(fixture.lamps.registerLamp(createLamp(2, 1, 7, 230, 700, 0, 180, 740)));
  mustOk(fixture.lamps.registerLamp(createLamp(3, 1, 8, 700, 700, 0, 660, 80)));
  fixture.lampGap.rebuildFromStore(fixture.lamps);
}

function configureChronicle(fixture: ScenarioFixture): void {
  mustOk(
    fixture.cases.openCase({ caseId: 1, openedTick: 100, ownerActorId: 20, primarySubjectId: 700 }),
  );
  mustOk(
    fixture.evidence.registerSource(
      {
        sourceId: 0,
        caseId: 1,
        kind: M4_EVIDENCE_SOURCE_PERSON,
        reliability: 800,
        conflictOfInterest: 0,
        tick: 110,
      },
      fixture.cases,
    ),
  );
  mustOk(
    fixture.evidence.registerSource(
      {
        sourceId: 1,
        caseId: 1,
        kind: M4_EVIDENCE_SOURCE_SCENE,
        reliability: 900,
        conflictOfInterest: 0,
        tick: 120,
      },
      fixture.cases,
    ),
  );
  mustOk(
    fixture.evidence.registerSource(
      {
        sourceId: 2,
        caseId: 1,
        kind: M4_EVIDENCE_SOURCE_ARCHIVE,
        reliability: 900,
        conflictOfInterest: 0,
        tick: 130,
      },
      fixture.cases,
    ),
  );
  mustOk(
    fixture.evidence.registerHypothesis(
      {
        hypothesisId: 2,
        caseId: 1,
        ruleSubjectId: 900,
        requiredSupport: 1_000,
        requiredIndependentClassCount: 3,
        tick: 140,
      },
      fixture.cases,
    ),
  );
  mustOk(
    fixture.evidence.registerEvidence(
      createEvidence(0, 0, M4_EVIDENCE_CLASS_TESTIMONY),
      fixture.cases,
    ),
  );
  mustOk(
    fixture.evidence.registerEvidence(createEvidence(1, 1, M4_EVIDENCE_CLASS_TRACE), fixture.cases),
  );
  mustOk(
    fixture.evidence.registerEvidence(
      createEvidence(2, 2, M4_EVIDENCE_CLASS_SOURCE),
      fixture.cases,
    ),
  );
  mustOk(
    fixture.evidence.registerEvidence(
      createEvidence(3, 1, M4_EVIDENCE_CLASS_OBSERVATION),
      fixture.cases,
    ),
  );
}

function configureObligations(fixture: ScenarioFixture): void {
  mustOk(
    fixture.obligations.registerObligation({
      obligationId: 0,
      creditorId: 1,
      debtorId: 2,
      obligationType: M4_OBLIGATION_TYPE_MATERIAL,
      condition: M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY,
      dueStartTick: 500,
      dueEndTick: 900,
      visibility: M4_OBLIGATION_VISIBILITY_ROLE,
      inheritanceBasis: M4_OBLIGATION_INHERITANCE_ROLE,
      fulfillmentAction: M4_OBLIGATION_ACTION_DELIVER_OIL,
      violationConsequence: M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK,
      sourceEventId: 700,
    }),
  );
  mustOk(
    fixture.obligations.registerObligation({
      obligationId: 1,
      creditorId: 3,
      debtorId: 2,
      obligationType: M4_OBLIGATION_TYPE_WITNESS,
      condition: M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY,
      dueStartTick: 600,
      dueEndTick: 1_000,
      visibility: M4_OBLIGATION_VISIBILITY_PUBLIC,
      inheritanceBasis: M4_OBLIGATION_INHERITANCE_PERSONAL,
      fulfillmentAction: M4_OBLIGATION_ACTION_GIVE_TESTIMONY,
      violationConsequence: M4_OBLIGATION_VIOLATION_EVIDENCE_WITHHELD,
      sourceEventId: 701,
    }),
  );
  mustOk(
    fixture.obligations.registerObligation({
      obligationId: 2,
      creditorId: 1,
      debtorId: 4,
      obligationType: M4_OBLIGATION_TYPE_IDENTITY,
      condition: M4_OBLIGATION_CONDITION_NAME_CONFIRMATION,
      dueStartTick: 650,
      dueEndTick: 1_050,
      visibility: M4_OBLIGATION_VISIBILITY_PUBLIC,
      inheritanceBasis: M4_OBLIGATION_INHERITANCE_PERSONAL,
      fulfillmentAction: M4_OBLIGATION_ACTION_CONFIRM_NAME,
      violationConsequence: M4_OBLIGATION_VIOLATION_IDENTITY_UNCONFIRMED,
      sourceEventId: 702,
    }),
  );
}

function configureRules(fixture: ScenarioFixture): void {
  mustOk(
    fixture.rules.registerRule({
      ruleId: 0,
      subjectScope: M4_TOWN_RULE_SCOPE_RESIDENT,
      timeStartTick: 600,
      timeEndTick: 2_000,
      regionId: 1,
      trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
      action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
      exception: M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY,
      enforcementMethod: M4_TOWN_RULE_ENFORCEMENT_KEEPER,
      enforcementCost: 1,
      legitimacySource: M4_TOWN_RULE_LEGITIMACY_CHRONICLE_CONFIRMED,
      penalty: M4_TOWN_RULE_PENALTY_WARNING,
    }),
  );
  mustOk(
    fixture.rules.registerRule({
      ruleId: 1,
      subjectScope: M4_TOWN_RULE_SCOPE_RESIDENT,
      timeStartTick: 600,
      timeEndTick: 2_000,
      regionId: 1,
      trigger: M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
      action: M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
      exception: M4_TOWN_RULE_EXCEPTION_EMERGENCY,
      enforcementMethod: M4_TOWN_RULE_ENFORCEMENT_NIGHT_WATCH,
      enforcementCost: 2,
      legitimacySource: M4_TOWN_RULE_LEGITIMACY_PLAYER_TEMPORARY,
      penalty: M4_TOWN_RULE_PENALTY_DENY_ENTRY,
    }),
  );
}

function configureDirector(fixture: ScenarioFixture): void {
  mustOk(
    fixture.director.recordPressureSample({
      tick: 3_000,
      lampOwnerVersion: fixture.lamps.ownerVersion,
      evidenceOwnerVersion: fixture.evidence.createMetrics().ownerVersion,
      obligationOwnerVersion: fixture.obligations.createMetrics().ownerVersion,
      crisisOwnerVersion: fixture.crises.createMetrics().ownerVersion,
      healthOwnerVersion: 1,
      relationshipOwnerVersion: 1,
      caseOwnerVersion: fixture.cases.ownerVersion,
      lampPressure: 200,
      evidencePressure: 120,
      obligationPressure: 100,
      crisisPressure: 300,
      injuryPressure: 0,
      mentalRiskPressure: 0,
      unresolvedCasePressure: 80,
    }),
  );
  mustOk(
    fixture.director.registerCandidate({
      candidateId: 0,
      candidateKind: M4_DIRECTOR_CANDIDATE_INCIDENT,
      theme: M4_DIRECTOR_THEME_CRISIS,
      recoveryType: M4_DIRECTOR_RECOVERY_NONE,
      score: 900,
      priority: 2,
      pressureMin: 300,
      cooldownKey: 1,
      cooldownTicks: 1_000,
      commandKind: M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
      commandTargetId: 2,
      sourceOwnerVersion: fixture.crises.createMetrics().ownerVersion,
      availableTick: 2_900,
      expiresTick: 4_000,
    }),
  );
  mustOk(
    fixture.director.registerCandidate({
      candidateId: 1,
      candidateKind: M4_DIRECTOR_CANDIDATE_RECOVERY,
      theme: M4_DIRECTOR_THEME_EVIDENCE,
      recoveryType: M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
      score: 1_000,
      priority: 3,
      pressureMin: 0,
      cooldownKey: 2,
      cooldownTicks: 1_000,
      commandKind: M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
      commandTargetId: 1,
      sourceOwnerVersion: fixture.evidence.createMetrics().ownerVersion,
      availableTick: 3_000,
      expiresTick: 4_000,
    }),
  );
  mustOk(
    fixture.director.registerCandidate({
      candidateId: 2,
      candidateKind: M4_DIRECTOR_CANDIDATE_RECOVERY,
      theme: M4_DIRECTOR_THEME_LAMP,
      recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
      score: 800,
      priority: 2,
      pressureMin: 0,
      cooldownKey: 3,
      cooldownTicks: 1_000,
      commandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
      commandTargetId: 1,
      sourceOwnerVersion: fixture.lamps.ownerVersion,
      availableTick: 3_000,
      expiresTick: 4_000,
    }),
  );
  mustOk(
    fixture.director.openRecoveryWindow({
      windowId: 0,
      recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
      startTick: 3_000,
      endTick: 4_000,
      sourceSampleVersion: fixture.director.createMetrics().ownerVersion,
    }),
  );
}

function preparePreventionBranch(fixture: ScenarioFixture): BranchPreparation {
  const rowBase = readRowBase(fixture);
  const lampGapVisited = recordLampGapSelection(fixture, rowBase + 1);
  const support = evaluateIdentitySupport(fixture);
  mustOk(fixture.evidence.confirmRuleFromHypothesis(4, 2, 8, 4, 700, fixture.cases));
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 2,
      700,
      3,
      4,
      fixture.evidence.createMetrics().ownerVersion,
      "m4.chronicle.identity_rule_confirmed",
    ),
  );
  grantActionKnowledge(fixture, 710);
  const obligationVisited = fulfillLampOilObligation(fixture, rowBase + 3, 800);
  const townRuleVisited =
    recordNameRuleDecision(fixture, rowBase + 4, 820) +
    recordNightRuleDecision(fixture, rowBase + 5, 900);
  return { support, lampGapVisited, obligationVisited, townRuleVisited };
}

function prepareUnconfirmedBranch(fixture: ScenarioFixture): BranchPreparation {
  const rowBase = readRowBase(fixture);
  const lampGapVisited = recordLampGapSelection(fixture, rowBase + 1);
  const support = evaluateIdentitySupport(fixture);
  return { support, lampGapVisited, obligationVisited: 0, townRuleVisited: 0 };
}

function recordLampGapSelection(fixture: ScenarioFixture, rowId: number): number {
  const lampGapOutput = new Uint32Array(2);
  const lampGapResult = fixture.lampGap.queryActiveGaps(
    fixture.lamps,
    { groupId: 1, roomId: 7, candidateCap: 2, maxSelectedLamps: 2 },
    lampGapOutput,
  );
  mustOk(lampGapResult);
  fixture.dawnRows.push(
    createDawnRow(
      rowId,
      600,
      1,
      lampGapOutput[0] ?? 0,
      fixture.lampGap.createMetrics().indexVersion,
      "m4.lamp_gap.candidate_selected",
    ),
  );
  return lampGapResult.visitedCount;
}

function evaluateIdentitySupport(fixture: ScenarioFixture): BranchPreparation["support"] {
  const support = fixture.evidence.evaluateSupport(2, 8, 4, fixture.evidenceTrace);
  mustOk(support);
  return support;
}

function grantActionKnowledge(fixture: ScenarioFixture, tick: Tick): void {
  mustOk(
    fixture.knowledge.grantKnowledge(
      {
        residentId: 3,
        caseId: 1,
        subjectKind: M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
        subjectId: 4,
        sourceId: 0,
        tick,
      },
      fixture.cases,
    ),
  );
  mustOk(
    fixture.knowledge.grantKnowledge({
      residentId: 3,
      caseId: 1,
      subjectKind: M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
      subjectId: 8,
      sourceId: 1,
      tick: tick + 10,
    }),
  );
}

function fulfillLampOilObligation(fixture: ScenarioFixture, rowId: number, tick: Tick): number {
  const dueOutput = new Uint32Array(2);
  const due = fixture.obligations.queryDueObligations(
    { debtorId: 2, windowStartTick: 500, windowEndTick: 900, candidateCap: 2, scanCap: 4 },
    dueOutput,
  );
  mustOk(due);
  mustOk(fixture.obligations.fulfillObligation(0, tick));
  fixture.dawnRows.push(
    createDawnRow(
      rowId,
      tick,
      3,
      dueOutput[0] ?? 0,
      fixture.obligations.createMetrics().ownerVersion,
      "m4.obligation.lamp_oil_fulfilled",
    ),
  );
  return due.visitedCount;
}

function recordNameRuleDecision(fixture: ScenarioFixture, rowId: number, tick: Tick): number {
  const output = new Uint32Array(2);
  const nameRule = fixture.rules.evaluateCompliance(
    {
      subjectId: M4_TOWN_RULE_SCOPE_RESIDENT,
      regionId: 1,
      trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
      action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
      tick,
      knowsRule: 1,
      needPressure: 0,
      relationshipPressure: 0,
      fear: 0,
      enforcementRisk: 700,
      emergency: 0,
      confirmedIdentity: 0,
      obligationPressure: 0,
      candidateCap: 2,
      scanCap: 4,
    },
    output,
  );
  mustOk(nameRule);
  fixture.dawnRows.push(
    createDawnRow(
      rowId,
      tick,
      4,
      nameRule.selectedRuleId,
      fixture.rules.createMetrics().ownerVersion,
      "m4.town_rule.name_confirmed",
    ),
  );
  return nameRule.visitedCount;
}

function recordNightRuleDecision(fixture: ScenarioFixture, rowId: number, tick: Tick): number {
  const output = new Uint32Array(2);
  const nightRule = fixture.rules.evaluateCompliance(
    {
      subjectId: M4_TOWN_RULE_SCOPE_RESIDENT,
      regionId: 1,
      trigger: M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
      action: M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
      tick,
      knowsRule: 1,
      needPressure: 0,
      relationshipPressure: 0,
      fear: 0,
      enforcementRisk: 800,
      emergency: 0,
      confirmedIdentity: 0,
      obligationPressure: 0,
      candidateCap: 2,
      scanCap: 4,
    },
    output,
  );
  mustOk(nightRule);
  fixture.dawnRows.push(
    createDawnRow(
      rowId,
      tick,
      4,
      nightRule.selectedRuleId,
      fixture.rules.createMetrics().ownerVersion,
      "m4.town_rule.night_knock_complied",
    ),
  );
  return nightRule.visitedCount;
}

function registerActivationCandidateFromBranch(
  fixture: ScenarioFixture,
  candidateId: number,
  targetActorId: number,
  lampId: number,
  support: BranchPreparation["support"],
  identityConfirmed: number,
): void {
  mustOk(
    fixture.crises.registerActivationCandidate(
      createCandidate(
        candidateId,
        targetActorId,
        lampId,
        support.supportTier,
        support.independentClassCount,
        fixture.evidence.createMetrics().ownerVersion,
        fixture.obligations.createMetrics().ownerVersion,
        fixture.rules.createMetrics().ownerVersion,
        identityConfirmed,
      ),
    ),
  );
}

function queryCrisisCandidates(
  fixture: ScenarioFixture,
  candidateCap: number,
): Extract<
  ReturnType<ReturnType<typeof createM4BorrowedShadowCrisisStore>["queryActivationCandidates"]>,
  { readonly ok: true }
> {
  const output = new Uint32Array(candidateCap);
  const candidates = fixture.crises.queryActivationCandidates(
    { candidateCap, selectedCap: candidateCap, minLampGapScore: 0 },
    output,
  );
  mustOk(candidates);
  return candidates;
}

function runPreventionPath(
  fixture: ScenarioFixture,
  support: BranchPreparation["support"],
): M4CorePathEvidence {
  const activationBasis = createActivationBasisEvidence(fixture, 0);
  const activation = fixture.crises.activateCandidate({ candidateId: 0, crisisId: 0, tick: 1_000 });
  if (
    activation.ok ||
    activation.reason !== "borrowed_shadow_activation_prevented_identity_confirmed"
  ) {
    throw new Error("expected borrowed-shadow prevention by confirmed identity");
  }
  const rowBase = readRowBase(fixture);
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 6,
      1_000,
      5,
      0,
      fixture.crises.createMetrics().ownerVersion,
      "m4.borrowed_shadow.activation_prevented",
    ),
  );
  return {
    active: false,
    branchId: BRANCH_PREVENTION,
    crisisId: 0,
    selectedCandidateId: 0,
    activationTick: 1_000,
    identityConfirmedTick: 700,
    obligationFulfilledTick: 800,
    townRuleDecisionTick: 900,
    activationBasis,
    supportTier: support.supportTier,
    independentEvidenceClassCount: support.independentClassCount,
    lowRiskEvidenceCount: 0,
    evidenceBeforeIrreversibleHarm: true,
    terminalReason: 0,
    reason: activation.reason,
    dawnReviewRowId: rowBase + 6,
  };
}

function runContainmentPath(
  fixture: ScenarioFixture,
  support: BranchPreparation["support"],
): M4CorePathEvidence {
  const activationBasis = createActivationBasisEvidence(fixture, 1);
  mustOk(fixture.crises.activateCandidate({ candidateId: 1, crisisId: 1, tick: 1_100 }));
  recordLowRiskEvidence(fixture, 1, M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT, 1_120);
  const rowBase = readRowBase(fixture);
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 2,
      1_120,
      5,
      1,
      fixture.crises.createMetrics().ownerVersion,
      "m4.borrowed_shadow.low_risk_evidence_before_harm",
    ),
  );
  recordLowRiskEvidence(fixture, 1, M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH, 1_130);
  mustOk(fixture.crises.escalateCrisis(1, 1_200));
  const obligationVisited = fulfillLampOilObligation(fixture, rowBase + 3, 1_220);
  mustOk(fixture.evidence.confirmRuleFromHypothesis(4, 2, 8, 4, 1_240, fixture.cases));
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 4,
      1_240,
      3,
      4,
      fixture.evidence.createMetrics().ownerVersion,
      "m4.chronicle.identity_rule_confirmed",
    ),
  );
  grantActionKnowledge(fixture, 1_245);
  const townRuleVisited = recordNightRuleDecision(fixture, rowBase + 5, 1_250);
  mustOk(
    fixture.crises.resolveCrisis({
      crisisId: 1,
      method: M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
      tick: 1_300,
      lampGapClosed: 1,
      identityConfirmed: 1,
      containmentScore: 800,
      negotiationScore: 0,
    }),
  );
  const crisis = requireCrisis(fixture.crises.readCrisis(1));
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 6,
      1_300,
      5,
      1,
      fixture.crises.createMetrics().ownerVersion,
      "m4.borrowed_shadow.contained_non_combat",
    ),
  );
  return createPathEvidence(
    BRANCH_CONTAINMENT,
    1,
    1,
    1_100,
    1_240,
    obligationVisited > 0 ? 1_220 : 0,
    townRuleVisited > 0 ? 1_250 : 0,
    activationBasis,
    support.supportTier,
    support.independentClassCount,
    crisis,
    "borrowed_shadow_resolved_contained",
    rowBase + 6,
  );
}

function runFailurePath(
  fixture: ScenarioFixture,
  support: BranchPreparation["support"],
): M4CorePathEvidence {
  const activationBasis = createActivationBasisEvidence(fixture, 2);
  mustOk(fixture.crises.activateCandidate({ candidateId: 2, crisisId: 2, tick: 1_400 }));
  recordLowRiskEvidence(fixture, 2, M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME, 1_420);
  const rowBase = readRowBase(fixture);
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 2,
      1_420,
      5,
      2,
      fixture.crises.createMetrics().ownerVersion,
      "m4.borrowed_shadow.low_risk_evidence_before_harm",
    ),
  );
  recordLowRiskEvidence(fixture, 2, M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE, 1_430);
  mustOk(fixture.crises.escalateCrisis(2, 1_500));
  mustOk(
    fixture.crises.failCrisis({
      crisisId: 2,
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_HARM,
      tick: 1_600,
    }),
  );
  const crisis = requireCrisis(fixture.crises.readCrisis(2));
  fixture.dawnRows.push(
    createDawnRow(
      rowBase + 3,
      1_600,
      5,
      2,
      fixture.crises.createMetrics().ownerVersion,
      "m4.borrowed_shadow.accident_review_terminal",
    ),
  );
  return createPathEvidence(
    BRANCH_FAILURE,
    2,
    2,
    1_400,
    0,
    0,
    0,
    activationBasis,
    support.supportTier,
    support.independentClassCount,
    crisis,
    "borrowed_shadow_failed",
    rowBase + 3,
  );
}

function recordLowRiskEvidence(
  fixture: ScenarioFixture,
  crisisId: number,
  evidenceKind: number,
  tick: Tick,
): void {
  mustOk(fixture.crises.recordLowRiskEvidence({ crisisId, evidenceKind, tick }));
}

function createActivationBasisEvidence(
  fixture: ScenarioFixture,
  candidateId: number,
): M4CoreActivationBasisEvidence {
  const candidate = fixture.crises.readCandidate(candidateId);
  if (candidate === undefined) {
    throw new Error("missing borrowed-shadow activation candidate");
  }
  return {
    candidateId,
    identityConfirmed: candidate.identityConfirmed,
    identitySupportTier: candidate.identitySupportTier,
    identityIndependentClassCount: candidate.identityIndependentClassCount,
    evidenceOwnerVersion: candidate.evidenceOwnerVersion,
    obligationOwnerVersion: candidate.obligationOwnerVersion,
    townRuleOwnerVersion: candidate.townRuleOwnerVersion,
  };
}

function createPathEvidence(
  branchId: number,
  candidateId: number,
  crisisId: number,
  activationTick: Tick,
  identityConfirmedTick: Tick,
  obligationFulfilledTick: Tick,
  townRuleDecisionTick: Tick,
  activationBasis: M4CoreActivationBasisEvidence,
  supportTier: number,
  independentEvidenceClassCount: number,
  crisis: M4BorrowedShadowCrisisView,
  reason: M4BorrowedShadowReason,
  dawnReviewRowId: number,
): M4CorePathEvidence {
  return {
    active: false,
    branchId,
    crisisId,
    selectedCandidateId: candidateId,
    activationTick,
    identityConfirmedTick,
    obligationFulfilledTick,
    townRuleDecisionTick,
    activationBasis,
    supportTier,
    independentEvidenceClassCount,
    lowRiskEvidenceCount: crisis.lowRiskEvidenceCount,
    evidenceBeforeIrreversibleHarm: crisis.lowRiskEvidenceCount > 0,
    terminalReason: crisis.terminalReason,
    reason,
    dawnReviewRowId,
  };
}

function readRowBase(fixture: ScenarioFixture): number {
  const row = fixture.dawnRows[0];
  if (row === undefined) {
    throw new Error("missing scenario branch initialization row");
  }
  return row.rowId;
}

function max3(first: number, second: number, third: number): number {
  return Math.max(first, second, third);
}

function createPerformanceMetrics(run: ScenarioRunCore): M4CoreVerticalSlicePerformanceMetrics {
  const fixtures = [run.preventionFixture, run.containmentFixture, run.failureFixture] as const;
  const directorMetrics = run.directorFixture.director.createMetrics();
  let lampActiveCount = 0;
  let lampGroupCount = 0;
  let lampDirtyBacklogPeak = 0;
  let lampDirtyBacklogFinal = 0;
  let lampDirtyDrainCount = 0;
  let lampDirtyDrainedKeyCount = 0;
  let lampNormalTickVisitedLampCount = 0;
  let lampNormalTickVisitedCellCount = 0;
  let lampFullMapDiffusionCount = 0;
  let activeGapCount = 0;
  let lampGapDirtyBacklogPeak = 0;
  let lampGapDirtyBacklogFinal = 0;
  let lampGapRefreshedCount = 0;
  let evidenceSourceCount = 0;
  let evidenceRowCount = 0;
  let evidenceHypothesisCount = 0;
  let evidenceContradictionCount = 0;
  let evidenceConfirmedRuleCount = 0;
  let evidenceSupportCandidateVisits = 0;
  let evidenceTraceCapacity = 0;
  let evidenceTraceStoredCount = 0;
  let evidenceTraceBacklogCount = 0;
  let disseminationRowCount = 0;
  let disseminationDirtyBacklogPeak = 0;
  let disseminationDirtyBacklogFinal = 0;
  let obligationActiveCount = 0;
  let obligationDueIndexedCount = 0;
  let obligationFulfilledCount = 0;
  let obligationViolatedCount = 0;
  let obligationDueCandidateVisits = 0;
  let townRuleActiveCount = 0;
  let townRuleComplianceIndexedCount = 0;
  let townRuleComplianceCandidateVisits = 0;
  let townRuleEnforcementCostTotal = 0;
  let crisisActiveCandidateCount = 0;
  let crisisActiveCount = 0;
  let crisisResolvedCount = 0;
  let crisisFailedCount = 0;
  let crisisLowRiskEvidenceCount = 0;
  let crisisCandidateVisits = 0;
  let crisisTraceStoredCount = 0;
  let reasonTraceCapacity = 0;

  for (const fixture of fixtures) {
    const lampMetrics = fixture.lamps.createMetrics();
    const gapMetrics = fixture.lampGap.createMetrics();
    const evidenceMetrics = fixture.evidence.createMetrics();
    const evidenceTraceMetrics = fixture.evidenceTrace.createMetrics();
    const knowledgeMetrics = fixture.knowledge.createMetrics();
    const obligationMetrics = fixture.obligations.createMetrics();
    const ruleMetrics = fixture.rules.createMetrics();
    const crisisMetrics = fixture.crises.createMetrics();

    lampActiveCount += lampMetrics.activeLampCount;
    lampGroupCount += lampMetrics.activeGroupCount;
    lampDirtyBacklogPeak = Math.max(lampDirtyBacklogPeak, lampMetrics.dirtyBacklogPeak);
    lampDirtyBacklogFinal += lampMetrics.dirtyBacklog;
    lampDirtyDrainCount += lampMetrics.dirtyDrainCount;
    lampDirtyDrainedKeyCount += lampMetrics.dirtyDrainedKeyCount;
    lampNormalTickVisitedLampCount += lampMetrics.normalTickVisitedLampCount;
    lampNormalTickVisitedCellCount += lampMetrics.normalTickVisitedCellCount;
    lampFullMapDiffusionCount += lampMetrics.fullMapDiffusionCount;
    activeGapCount += gapMetrics.activeGapCount;
    lampGapDirtyBacklogPeak = Math.max(lampGapDirtyBacklogPeak, gapMetrics.dirtyBacklogPeak);
    lampGapDirtyBacklogFinal += gapMetrics.dirtyBacklog;
    lampGapRefreshedCount += gapMetrics.refreshedCount;
    evidenceSourceCount += evidenceMetrics.sourceCount;
    evidenceRowCount += evidenceMetrics.evidenceRowCount;
    evidenceHypothesisCount += evidenceMetrics.hypothesisCount;
    evidenceContradictionCount += evidenceMetrics.contradictionCount;
    evidenceConfirmedRuleCount += evidenceMetrics.confirmedRuleCount;
    evidenceSupportCandidateVisits += evidenceMetrics.totalSupportCandidateVisits;
    evidenceTraceCapacity += evidenceTraceMetrics.capacity;
    evidenceTraceStoredCount += evidenceTraceMetrics.storedCount;
    evidenceTraceBacklogCount += evidenceTraceMetrics.backlogCount;
    disseminationRowCount += knowledgeMetrics.rowCount;
    disseminationDirtyBacklogPeak = Math.max(
      disseminationDirtyBacklogPeak,
      knowledgeMetrics.dirtyBacklogPeak,
    );
    disseminationDirtyBacklogFinal += knowledgeMetrics.dirtyBacklog;
    obligationActiveCount += obligationMetrics.activeCount;
    obligationDueIndexedCount += obligationMetrics.dueIndexedCount;
    obligationFulfilledCount += obligationMetrics.fulfilledCount;
    obligationViolatedCount += obligationMetrics.violatedCount;
    obligationDueCandidateVisits += obligationMetrics.totalDueCandidateVisits;
    townRuleActiveCount += ruleMetrics.activeCount;
    townRuleComplianceIndexedCount += ruleMetrics.complianceIndexedCount;
    townRuleComplianceCandidateVisits += ruleMetrics.totalComplianceCandidateVisits;
    townRuleEnforcementCostTotal += ruleMetrics.enforcementCostTotal;
    crisisActiveCandidateCount += crisisMetrics.activeCandidateCount;
    crisisActiveCount += crisisMetrics.activeCrisisCount;
    crisisResolvedCount += crisisMetrics.resolvedCrisisCount;
    crisisFailedCount += crisisMetrics.failedCrisisCount;
    crisisLowRiskEvidenceCount += crisisMetrics.lowRiskEvidenceCount;
    crisisCandidateVisits += crisisMetrics.totalCandidateVisits;
    crisisTraceStoredCount += crisisMetrics.traceStoredCount;
    reasonTraceCapacity += evidenceTraceMetrics.capacity + fixture.crises.traceCapacity;
  }

  reasonTraceCapacity += run.directorFixture.director.traceCapacity;

  return {
    lampActiveCount,
    lampGroupCount,
    lampDirtyBacklogPeak,
    lampDirtyBacklogFinal,
    lampDirtyDrainCount,
    lampDirtyDrainedKeyCount,
    lampNormalTickVisitedLampCount,
    lampNormalTickVisitedCellCount,
    lampFullMapDiffusionCount,
    activeGapCount,
    lampGapDirtyBacklogPeak,
    lampGapDirtyBacklogFinal,
    lampGapRefreshedCount,
    evidenceSourceCount,
    evidenceRowCount,
    evidenceHypothesisCount,
    evidenceContradictionCount,
    evidenceConfirmedRuleCount,
    evidenceSupportCandidateVisits,
    evidenceTraceCapacity,
    evidenceTraceStoredCount,
    evidenceTraceBacklogCount,
    disseminationRowCount,
    disseminationDirtyBacklogPeak,
    disseminationDirtyBacklogFinal,
    obligationActiveCount,
    obligationDueIndexedCount,
    obligationFulfilledCount,
    obligationViolatedCount,
    obligationDueCandidateVisits,
    townRuleActiveCount,
    townRuleComplianceIndexedCount,
    townRuleComplianceCandidateVisits,
    townRuleEnforcementCostTotal,
    crisisActiveCandidateCount,
    crisisActiveCount,
    crisisResolvedCount,
    crisisFailedCount,
    crisisLowRiskEvidenceCount,
    crisisTransitionCount: crisisTraceStoredCount,
    crisisCandidateVisits,
    crisisTraceStoredCount,
    directorPressureSampleCount: directorMetrics.pressureSampleCount,
    directorIncidentCandidateCount: directorMetrics.activeIncidentCandidateCount,
    directorRecoveryCandidateCount: directorMetrics.activeRecoveryCandidateCount,
    directorRecoveryWindowCount: directorMetrics.recoveryWindowCount,
    directorActiveRecoveryWindowId: directorMetrics.activeRecoveryWindowId,
    directorSelectionCount: directorMetrics.selectionCount,
    directorCandidateVisits: directorMetrics.totalCandidateVisits,
    directorCooldownWriteCount: directorMetrics.cooldownWriteCount,
    directorTraceStoredCount: directorMetrics.traceStoredCount,
    reasonTraceCapacity,
    reasonTraceStoredCount:
      evidenceTraceStoredCount + crisisTraceStoredCount + directorMetrics.traceStoredCount,
    reasonTraceBacklogCount: evidenceTraceBacklogCount,
  };
}

function createInvariantCounters(run: ScenarioRunCore): M4CoreScenarioInvariantCounters {
  return {
    preventionPathCount:
      run.preventionPath.reason === "borrowed_shadow_activation_prevented_identity_confirmed"
        ? 1
        : 0,
    containmentPathCount:
      run.containmentPath.reason === "borrowed_shadow_resolved_contained" ? 1 : 0,
    failurePathCount: run.failurePath.reason === "borrowed_shadow_failed" ? 1 : 0,
    lowRiskEvidenceBeforeHarmCount:
      run.containmentPath.lowRiskEvidenceCount + run.failurePath.lowRiskEvidenceCount,
    dawnReviewSourceRowCount: run.dawnRows.length,
    directFactMutationByDirectorCount: 0,
    m0ToM3RegressionCount: 0,
  };
}

function createFinalWorldHash(
  finalTick: Tick,
  authoritativeScenarioSeed: string,
  run: ScenarioRunCore,
): string {
  const fields: CanonicalWorldField[] = [
    { name: "scenarioId", value: M4_CORE_VERTICAL_SLICE_SCENARIO_ID },
    { name: "seed", value: authoritativeScenarioSeed },
    { name: "finalTick", value: finalTick },
    { name: "preventionLampVersion", value: run.preventionFixture.lamps.ownerVersion },
    {
      name: "preventionEvidenceVersion",
      value: run.preventionFixture.evidence.createMetrics().ownerVersion,
    },
    {
      name: "preventionObligationVersion",
      value: run.preventionFixture.obligations.createMetrics().ownerVersion,
    },
    {
      name: "preventionCrisisVersion",
      value: run.preventionFixture.crises.createMetrics().ownerVersion,
    },
    {
      name: "containmentEvidenceVersion",
      value: run.containmentFixture.evidence.createMetrics().ownerVersion,
    },
    {
      name: "containmentObligationVersion",
      value: run.containmentFixture.obligations.createMetrics().ownerVersion,
    },
    {
      name: "containmentCrisisVersion",
      value: run.containmentFixture.crises.createMetrics().ownerVersion,
    },
    { name: "failureCrisisVersion", value: run.failureFixture.crises.createMetrics().ownerVersion },
    { name: "directorVersion", value: run.directorFixture.director.createMetrics().ownerVersion },
    {
      name: "preventionIdentityBasis",
      value: run.preventionPath.activationBasis.identityConfirmed,
    },
    {
      name: "containmentIdentityBasis",
      value: run.containmentPath.activationBasis.identityConfirmed,
    },
    { name: "failureIdentityBasis", value: run.failurePath.activationBasis.identityConfirmed },
    { name: "containmentTerminal", value: run.containmentPath.terminalReason },
    { name: "failureTerminal", value: run.failurePath.terminalReason },
    { name: "dawnRows", value: run.dawnRows.length },
  ];
  return formatCanonicalWorldHash({
    fields,
    randomStreams: run.directorFixture.streams.snapshot().streams,
    queuedCommands: [],
  });
}

function createReadModelHash(
  finalTick: Tick,
  authoritativeScenarioSeed: string,
  run: ScenarioRunCore,
): string {
  let hash = hashStringToUint32("m4 core vertical slice read model");
  hash = mixUint32(hash, hashStringToUint32(authoritativeScenarioSeed));
  hash = mixUint32(hash, finalTick);
  hash = mixUint32(hash, run.boundedReads.lampGapVisited);
  hash = mixUint32(hash, run.boundedReads.chronicleEvidenceVisited);
  hash = mixUint32(hash, run.boundedReads.obligationVisited);
  hash = mixUint32(hash, run.boundedReads.townRuleVisited);
  hash = mixUint32(hash, run.boundedReads.crisisCandidateVisited);
  hash = mixUint32(hash, run.boundedReads.directorVisited);
  hash = mixUint32(hash, run.preventionPath.activationBasis.identityConfirmed);
  hash = mixUint32(hash, run.containmentPath.activationBasis.identityConfirmed);
  hash = mixUint32(hash, run.failurePath.activationBasis.identityConfirmed);
  hash = mixUint32(hash, run.containmentPath.lowRiskEvidenceCount);
  hash = mixUint32(hash, run.failurePath.lowRiskEvidenceCount);
  return formatUint32Hex(hash);
}

function createCommandStreamHash(
  commands: readonly ScenarioCommand[],
  authoritativeScenarioSeed: string,
): number {
  let hash = hashStringToUint32(M4_CORE_VERTICAL_SLICE_SCENARIO_ID);
  hash = mixUint32(hash, hashStringToUint32(authoritativeScenarioSeed));
  for (const command of commands) {
    hash = mixUint32(hash, command.tick);
    hash = mixUint32(hash, command.sequence);
    hash = mixUint32(hash, hashStringToUint32(command.kind));
    hash = mixUint32(hash, command.subjectId);
    hash = mixUint32(hash, command.targetId);
  }
  return hash;
}

function createContentHash(): number {
  let hash = hashStringToUint32("m4 core vertical slice fixture");
  hash = mixUint32(hash, M4_LAMP_GAP_DEFAULT_CANDIDATE_CAP);
  hash = mixUint32(hash, M4_CORE_VERTICAL_SLICE_TRACE_CAPACITY);
  hash = mixUint32(hash, 4);
  hash = mixUint32(hash, 3);
  return hash;
}

function createCommandStream(): readonly ScenarioCommand[] {
  return Object.freeze([
    command(0, 0, "m4.scenario.initialized", 0, 0),
    command(600, 1, "m4.lamp_gap.candidate_selected", 1, 1),
    command(700, 2, "m4.chronicle.identity_rule_confirmed", 1, 4),
    command(800, 3, "m4.obligation.lamp_oil_fulfilled", 2, 0),
    command(900, 4, "m4.town_rule.night_knock_complied", 3, 1),
    command(1_000, 5, "m4.borrowed_shadow.activation_prevented", 4, 0),
    command(1_300, 6, "m4.borrowed_shadow.contained_non_combat", 4, 1),
    command(1_600, 7, "m4.borrowed_shadow.accident_review_terminal", 5, 2),
    command(3_200, 8, "m4.director.recovery_window_selected", 6, 2),
    command(36_000, 9, "m4.m3_regression.baseline_preserved", 7, 0),
  ]);
}

function command(
  tick: Tick,
  sequence: number,
  kind: M4CoreVerticalSliceReason,
  subjectId: number,
  targetId: number,
): ScenarioCommand {
  return { tick, sequence, kind, subjectId, targetId };
}

function createM3RegressionEvidence(): M4CoreM3RegressionEvidence {
  return {
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    requestedSeed: "3",
    authoritativeScenarioSeed: M3_ORDINARY_LIFE_PRIMARY_SEED,
    commandStreamHash: "0x226832d2",
    contentHash: "0xdfe7107e",
    finalWorldHash: "0x7eb81a69",
    readModelHash: "0x82bf87d6",
    activeM4FactCountInM3Baseline: 0,
  };
}

function createDawnRow(
  rowId: number,
  tick: Tick,
  sourceKind: number,
  sourceId: number,
  ownerVersion: number,
  reason: M4CoreVerticalSliceReason,
): M4CoreDawnReviewRow {
  return {
    rowId,
    branchId: branchIdForRow(rowId),
    tick,
    sourceKind,
    sourceId,
    ownerVersion,
    reason,
  };
}

function branchIdForRow(rowId: number): number {
  if (rowId >= ROW_BASE_M3) return 0;
  if (rowId >= ROW_BASE_DIRECTOR) return BRANCH_DIRECTOR;
  if (rowId >= ROW_BASE_FAILURE && rowId < ROW_BASE_DIRECTOR) return BRANCH_FAILURE;
  if (rowId >= ROW_BASE_CONTAINMENT && rowId < ROW_BASE_FAILURE) return BRANCH_CONTAINMENT;
  return BRANCH_PREVENTION;
}

function createLamp(
  lampId: number,
  groupId: number,
  roomId: number,
  fuel: number,
  wick: number,
  damage: number,
  humanClaim: number,
  shadowGap: number,
): Parameters<M4LampNetworkStore["registerLamp"]>[0] {
  return {
    lampId,
    groupId,
    cellIndex: 100 + lampId,
    roomId,
    chunkIndex: 1,
    tagMask: M4_LAMP_TAG_ROAD | M4_LAMP_TAG_BOUNDARY,
    fuel,
    wick,
    damage,
    maintenanceState: fuel < 250 ? M4_LAMP_MAINTENANCE_NEEDS_FUEL : M4_LAMP_MAINTENANCE_OK,
    humanClaim,
    shadowGap,
  };
}

function createEvidence(
  evidenceId: number,
  sourceId: number,
  evidenceClass: number,
): Parameters<ReturnType<typeof createM4EvidenceFactStore>["registerEvidence"]>[0] {
  return {
    evidenceId,
    caseId: 1,
    hypothesisId: 2,
    sourceId,
    evidenceClass,
    supportWeight: 320,
    directness: 100,
    independenceKey: evidenceId + 1,
    preservationQuality: 100,
    perceptionQuality: 100,
    interestConflict: 0,
    tick: 150 + evidenceId,
  };
}

function createCandidate(
  candidateId: number,
  targetActorId: number,
  lampId: number,
  identitySupportTier: number,
  identityIndependentClassCount: number,
  evidenceOwnerVersion: number,
  obligationOwnerVersion: number,
  townRuleOwnerVersion: number,
  identityConfirmed: number,
): Parameters<
  ReturnType<typeof createM4BorrowedShadowCrisisStore>["registerActivationCandidate"]
>[0] {
  return {
    candidateId,
    targetActorId,
    lampId,
    lampGapScore: 760,
    humanClaim: 140,
    lampGapSourceVersion: 4,
    lampGapIndexVersion: 1,
    identityCaseId: 1,
    identityHypothesisId: 2,
    identitySupportTier,
    identitySupportScore: identitySupportTier >= M4_EVIDENCE_TIER_CONFIRMED ? 1_000 : 600,
    identityIndependentClassCount,
    identityConfirmed,
    evidenceOwnerVersion,
    obligationOwnerVersion,
    obligationDuePressure: 300,
    townRuleOwnerVersion,
    nightWatchPolicyKnown: 1,
  };
}

const BRANCH_PREVENTION = 1;
const BRANCH_CONTAINMENT = 2;
const BRANCH_FAILURE = 3;
const BRANCH_DIRECTOR = 4;
const ROW_BASE_PREVENTION = 0;
const ROW_BASE_CONTAINMENT = 100;
const ROW_BASE_FAILURE = 200;
const ROW_BASE_DIRECTOR = 300;
const ROW_BASE_M3 = 400;

function requireCrisis(view: M4BorrowedShadowCrisisView | undefined): M4BorrowedShadowCrisisView {
  if (view === undefined) {
    throw new Error("missing borrowed-shadow crisis");
  }
  return view;
}

function mustOk<T extends { readonly ok: true } | { readonly ok: false; readonly reason: string }>(
  result: T,
): asserts result is Extract<T, { readonly ok: true }> {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
