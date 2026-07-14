import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = "HaulingClaimFactsIndex.readClaimFactsInto";
const HAULING_MAPPING_ROOT = "HaulingClaimFactsIndex.readMappingInto";
const HAULING_ROOTS = [
  "HaulingJobStore.adoptExistingClaimsInto",
  "HaulingJobStore.rollbackNewlyAdoptedInto",
  "HaulingJobStore.pickupAdoptedInto",
  "HaulingJobStore.terminalAdoptedInto",
  "HaulingJobStore.resumeCleanupInto",
  "HaulingJobStore.readAdoptedJobInto",
  "JobCoreStore.readCommittedAutonomyJobInto",
] as const;
const REST_ROOTS = [
  "RestJobDriverStore.adoptExistingClaimsInto",
  "RestJobDriverStore.rollbackNewlyAdoptedInto",
  "RestJobDriverStore.readAdoptedJobInto",
  "RestJobDriverStore.beginAdoptedInto",
  "RestJobDriverStore.tickAdoptedInto",
  "RestJobDriverStore.terminalAdoptedInto",
  "RestJobDriverStore.resumeCleanupInto",
] as const;
const TREATMENT_A_ROOTS = [
  "M3TreatmentJobStore.adoptExistingClaimsInto",
  "M3TreatmentJobStore.rollbackNewlyAdoptedInto",
  "M3TreatmentJobStore.readAdoptedJobInto",
] as const;
const TREATMENT_B_ROOTS = [
  "M3TreatmentJobStore.startPathingAdoptedInto",
  "M3TreatmentJobStore.beginAdoptedInto",
  "M3TreatmentJobStore.progressAdoptedInto",
] as const;
const TREATMENT_C_ROOTS = [
  "M3TreatmentJobStore.completeAdoptedInto",
  "M3TreatmentJobStore.terminalAdoptedInto",
  "M3TreatmentJobStore.resumeCleanupInto",
] as const;
const ITEM_STACK_ROOTS = [
  "ItemStackStore.readStackInto",
  "ItemStackStore.prepareAutonomousQuantityRemovalInto",
  "ItemStackStore.prepareAutonomousQuantityAdditionInto",
] as const;
const ITEM_STACK_COMMIT_ROOTS = [
  "commitPreparedItemStackQuantityRemoval",
  "commitPreparedItemStackQuantityAddition",
] as const;
const LAMP_ROOTS = [
  "M4LampNetworkStore.readLampInto",
  "M4LampNetworkStore.prepareRefillOrMaintenanceInto",
] as const;
const LAMP_COMMIT_BRIDGE = "commitPreparedM4LampMutation";
const TREATMENT_C_FORBIDDEN = [
  "ItemStackStore.readStack",
  "StorageLogisticsIndex.readSlot",
  "StorageLogisticsIndex.markSlotDirty",
  "ReservationLedger.acquire",
  "ReservationLedger.releaseAllForJob",
  "ReservationLedger.createSnapshot",
  "JobCoreStore.completeJob",
  "JobCoreStore.cancelJob",
  "JobCoreStore.failJob",
  "JobCoreStore.enterStep",
  "JobCoreStore.tickJob",
] as const;
const TREATMENT_C_COMMON_RECEIVER_METHODS = [
  "JobCoreStore.[JOB_CORE_TERMINAL_COMMIT]",
  "JobCoreStore.clearOriginShadow",
  "JobCoreStore.clearOwnerAutonomy",
  "JobCoreStore.matchesAutonomyTokenScalars",
  "JobCoreStore.prepareAutonomyTerminalScalarsInto",
  "JobCoreStore.pushFreeAutonomyJobId",
  "JobCoreStore.readCommittedAutonomyJobInto",
  "M3TreatmentJobStore.addTerminalCounts",
  "M3TreatmentJobStore.claimsAreCleared",
  "M3TreatmentJobStore.clearOrigin",
  "M3TreatmentJobStore.clearStoredClaims",
  "M3TreatmentJobStore.commitTerminalTailScalars",
  "M3TreatmentJobStore.copyStoredClaims",
  "M3TreatmentJobStore.currentJobCoreTombstoneDelta",
  "M3TreatmentJobStore.hasTerminalCounterHeadroom",
  "M3TreatmentJobStore.hasTerminalVersionHeadroom",
  "M3TreatmentJobStore.matchesCommittedTerminalJob",
  "M3TreatmentJobStore.matchesCommittedTreatmentIdentity",
  "M3TreatmentJobStore.matchesCommittedTreatmentJob",
  "M3TreatmentJobStore.matchesExactTreatmentClaims",
  "M3TreatmentJobStore.matchesTerminalDuplicateCaller",
  "M3TreatmentJobStore.matchesTreatmentClaimChannels",
  "M3TreatmentJobStore.originTerminalOutcome",
  "M3TreatmentJobStore.prepareAdoptedMutationRead",
  "M3TreatmentJobStore.prepareClaims",
  "M3TreatmentJobStore.prepareTerminalActiveRead",
  "M3TreatmentJobStore.prepareTerminalCoreScalars",
  "M3TreatmentJobStore.releaseStoredClaims",
  "M3TreatmentJobStore.removeActiveStepCount",
  "M3TreatmentJobStore.removeOriginCurrentCounts",
  "M3TreatmentJobStore.requiredWorkFor",
  "M3TreatmentJobStore.writeMutationSuccess",
  "M3TreatmentJobStore.writePendingMutationOutput",
  "ReservationLedger.hasExactClaimsOutputShape",
  "ReservationLedger.incrementChannelCount",
  "ReservationLedger.isOwner",
  "ReservationLedger.isValidClaimId",
  "ReservationLedger.readActiveClaimsInto",
  "ReservationLedger.readChannelCode",
  "ReservationLedger.releaseClaimNoVersion",
  "ReservationLedger.releaseClaimsInto",
  "ReservationLedger.resetActiveClaimsIntoOutput",
  "ReservationLedger.resetReleaseClaimsIntoOutput",
  "ReservationLedger.unlinkOwner",
  "ReservationLedger.unlinkTarget",
  "ReservationLedger.validateExactClaimHeader",
  "ReservationLedger.validateExactClaimPrefix",
  "ReservationLedger.version",
  "ReservationLedger.writeActiveClaimInto",
] as const;
const TREATMENT_C_RECEIVER_METHODS = [
  [
    TREATMENT_C_ROOTS[0],
    [
      ...TREATMENT_C_COMMON_RECEIVER_METHODS,
      "ItemStackStore.[ITEM_STACK_COMMIT]",
      "ItemStackStore.isActiveStackId",
      "ItemStackStore.prepareAutonomousQuantityRemovalInto",
      "ItemStackStore.readStackInto",
      "M3HealthConditionStore.[M3_HEALTH_TREATMENT_COMMIT]",
      "M3HealthConditionStore.prepareTreatmentConditionDeltaInto",
      "M3HealthConditionStore.readConditionInto",
      "M3TreatmentJobStore.commitFreshCompleteAppend",
      "M3TreatmentJobStore.commitFreshCompleteCoalesce",
      "M3TreatmentJobStore.commitHealthAppliedCompleteAppend",
      "M3TreatmentJobStore.commitHealthAppliedCompleteCoalesce",
      "M3TreatmentJobStore.commitHealthAppliedPhase",
      "M3TreatmentJobStore.commitStockConsumedPhase",
      "M3TreatmentJobStore.completeAdoptedInto",
      "M3TreatmentJobStore.finishCompletedRelease",
      "M3TreatmentJobStore.hasCompletedEffectCounterHeadroom",
      "M3TreatmentJobStore.matchesHealthMutationInput",
      "M3TreatmentJobStore.matchesStockRemovalInput",
      "M3TreatmentJobStore.prepareCompletedCore",
      "M3TreatmentJobStore.prepareCompletedTerminal",
      "M3TreatmentJobStore.prepareHealthEffect",
      "M3TreatmentJobStore.prepareStockEffect",
      "M3TreatmentJobStore.writeCompletedDuplicateIfExact",
      "ReservationLedger.reservedAmountForItem",
      "StorageLogisticsIndex.[STORAGE_DIRTY_APPEND_COMMIT]",
      "StorageLogisticsIndex.[STORAGE_DIRTY_COALESCE_COMMIT]",
      "StorageLogisticsIndex.findDirtyQueueIndex",
      "StorageLogisticsIndex.isActiveSlot",
      "StorageLogisticsIndex.prepareSlotDirtyInto",
      "StorageLogisticsIndex.readSlotInto",
    ],
  ],
  [
    TREATMENT_C_ROOTS[1],
    [
      ...TREATMENT_C_COMMON_RECEIVER_METHODS,
      "M3TreatmentJobStore.commitNegativeCleanupPending",
      "M3TreatmentJobStore.commitTerminalTail",
      "M3TreatmentJobStore.matchesStoredTerminalTuple",
      "M3TreatmentJobStore.prepareNegativeTerminal",
      "M3TreatmentJobStore.prepareTerminalCore",
      "M3TreatmentJobStore.terminalAdoptedInto",
      "M3TreatmentJobStore.writeTerminalDuplicateIfExact",
    ],
  ],
  [
    TREATMENT_C_ROOTS[2],
    [
      ...TREATMENT_C_COMMON_RECEIVER_METHODS,
      "M3TreatmentJobStore.commitTerminalTail",
      "M3TreatmentJobStore.matchesStoredTerminalTuple",
      "M3TreatmentJobStore.prepareCleanupResume",
      "M3TreatmentJobStore.prepareTerminalCore",
      "M3TreatmentJobStore.resumeCleanupInto",
      "M3TreatmentJobStore.writeTerminalDuplicateIfExact",
    ],
  ],
] as const;
const TREATMENT_B_FORBIDDEN = [
  "JobCoreStore.enterStep",
  "JobCoreStore.tickJob",
  "JobCoreStore.completeJob",
  "JobCoreStore.cancelJob",
  "JobCoreStore.failJob",
  "JobCoreStore.requestInterruption",
  "ReservationLedger.readActiveClaimsInto",
  "ReservationLedger.acquire",
  "ReservationLedger.releaseClaimsInto",
  "M3HealthConditionStore.readConditionInto",
  "ItemStackStore.readStackInto",
  "StorageLogisticsIndex.readSlotInto",
] as const;
const TREATMENT_B_RECEIVER_METHODS = [
  [
    TREATMENT_B_ROOTS[0],
    [
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "M3TreatmentJobStore.isOrdinaryAdoptedMutationState",
      "M3TreatmentJobStore.matchesCommittedTreatmentIdentity",
      "M3TreatmentJobStore.matchesCommittedTreatmentJob",
      "M3TreatmentJobStore.mutationHeadroomReason",
      "M3TreatmentJobStore.prepareAdoptedMutationRead",
      "M3TreatmentJobStore.requiredWorkFor",
      "M3TreatmentJobStore.startPathingAdoptedInto",
      "M3TreatmentJobStore.writeMutationSuccess",
    ],
  ],
  [
    TREATMENT_B_ROOTS[1],
    [
      "JobCoreStore.enterAutonomyStepInto",
      "JobCoreStore.finishAutonomyMutationInto",
      "JobCoreStore.matchesAutonomyToken",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "JobCoreStore.validateAutonomyMutation",
      "M3TreatmentJobStore.beginAdoptedInto",
      "M3TreatmentJobStore.isOrdinaryAdoptedMutationState",
      "M3TreatmentJobStore.matchesCommittedTreatmentIdentity",
      "M3TreatmentJobStore.matchesCommittedTreatmentJob",
      "M3TreatmentJobStore.mutationHeadroomReason",
      "M3TreatmentJobStore.prepareAdoptedMutationRead",
      "M3TreatmentJobStore.requiredWorkFor",
      "M3TreatmentJobStore.writeMutationSuccess",
    ],
  ],
  [
    TREATMENT_B_ROOTS[2],
    [
      "JobCoreStore.[JOB_CORE_PROGRESS_COMMIT]",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.prepareAutonomyProgressScalarsInto",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "M3TreatmentJobStore.isOrdinaryAdoptedMutationState",
      "M3TreatmentJobStore.matchesCommittedTreatmentIdentity",
      "M3TreatmentJobStore.matchesCommittedTreatmentJob",
      "M3TreatmentJobStore.mutationHeadroomReason",
      "M3TreatmentJobStore.prepareAdoptedMutationRead",
      "M3TreatmentJobStore.progressAdoptedInto",
      "M3TreatmentJobStore.requiredWorkFor",
      "M3TreatmentJobStore.writeMutationSuccess",
    ],
  ],
] as const;
const TREATMENT_A_FORBIDDEN = [
  "JobCoreStore.createRunningJobInto",
  "JobCoreStore.createJob",
  "JobCoreStore.rollbackRunningAutonomyJobInto",
  "M3TreatmentJobStore.readJob",
  "ItemStackStore.readStack",
  "M3HealthConditionStore.readCondition",
] as const;
const TREATMENT_A_RECEIVER_METHODS = [
  [
    TREATMENT_A_ROOTS[0],
    [
      "JobCoreStore.createRunningJobScalarsInto",
      "JobCoreStore.[JOB_CORE_ORIGIN_TERMINAL_MATCH]",
      "JobCoreStore.matchesAutonomyToken",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.readAutonomyJobTokenInto",
      "JobCoreStore.resetTokenOutput",
      "JobCoreStore.version",
      "JobCoreStore.writeTokenOutput",
      "M3TreatmentJobStore.adoptExistingClaimsInto",
      "M3TreatmentJobStore.captureTerminalOrigin",
      "M3TreatmentJobStore.claimsAreCleared",
      "M3TreatmentJobStore.clearOrigin",
      "M3TreatmentJobStore.hasFailedJobCoreAdoption",
      "M3TreatmentJobStore.isExactAdoptionPreflight",
      "M3TreatmentJobStore.isOriginlessAdoptionReadyRow",
      "M3TreatmentJobStore.isVirginDriverRow",
      "M3TreatmentJobStore.matchesReservedDriverOrigin",
      "M3TreatmentJobStore.matchesVisibleTerminalOrigin",
      "M3TreatmentJobStore.requiredWorkFor",
      "M3TreatmentJobStore.writeAdopted",
      "M3TreatmentJobStore.writeAdoptionMetrics",
    ],
  ],
  [
    TREATMENT_A_ROOTS[1],
    [
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.resetTokenOutput",
      "JobCoreStore.rollbackRunningAutonomyJobScalarsInto",
      "JobCoreStore.version",
      "JobCoreStore.writeTokenOutput",
      "M3TreatmentJobStore.rollbackNewlyAdoptedInto",
      "M3TreatmentJobStore.clearOrigin",
      "M3TreatmentJobStore.clearStoredClaims",
      "M3TreatmentJobStore.restoreTerminalOrigin",
      "M3TreatmentJobStore.writeAdoptionMetrics",
      "M3TreatmentJobStore.writeRolledBackShadow",
    ],
  ],
  [
    TREATMENT_A_ROOTS[2],
    [
      "M3TreatmentJobStore.readAdoptedJobInto",
      "M3TreatmentJobStore.writeAdoptedJobOutput",
      "M3TreatmentJobStore.writeMetricsInto",
    ],
  ],
] as const;
const HEALTH_ROOTS = [
  "M3HealthConditionStore.readConditionInto",
  "M3HealthConditionStore.prepareTreatmentConditionDeltaInto",
] as const;
const HEALTH_COMMIT_BRIDGE = "commitPreparedM3HealthTreatment";
const STORAGE_SUPPLY_ROOT = "StorageLogisticsIndex.selectSupplySlotsInto";
const STORAGE_OWNER_ROOTS = [
  "StorageLogisticsIndex.readSlotInto",
  "StorageLogisticsIndex.prepareSlotDirtyInto",
  STORAGE_SUPPLY_ROOT,
] as const;
const STORAGE_COMMIT_ROOTS = [
  "commitPreparedStorageDirtyAppend",
  "commitPreparedStorageDirtyCoalesce",
] as const;
const NEED_OWNER_ROOTS = ["NeedStore.readLaneInto", "NeedStore.prepareLaneDeltaInto"] as const;
const NEED_COMMIT_ROOTS = [
  "commitPreparedChangedNeedLaneMutation",
  "commitPreparedNoopNeedLaneMutation",
] as const;
const STORAGE_OWNER_RECEIVER_MANIFEST = [
  [
    STORAGE_OWNER_ROOTS[0],
    ["StorageLogisticsIndex.readSlotInto", "StorageLogisticsIndex.findDirtyQueueIndex"],
  ],
  [
    STORAGE_OWNER_ROOTS[1],
    [
      "StorageLogisticsIndex.prepareSlotDirtyInto",
      "StorageLogisticsIndex.isActiveSlot",
      "StorageLogisticsIndex.findDirtyQueueIndex",
    ],
  ],
  [
    STORAGE_OWNER_ROOTS[2],
    [
      "StorageLogisticsIndex.selectSupplySlotsInto",
      "StorageLogisticsIndex.captureSupplySelection",
      "StorageLogisticsIndex.matchesCapturedSupplySelection",
    ],
  ],
] as const;
const MEDICAL_CLAIM_FACT_ROOTS = [
  "M3MedicalClaimFactsIndex.readPatientInteractionInto",
  "M3MedicalClaimFactsIndex.readTreatmentPolicyInto",
] as const;
const MEDICAL_STOCK_ROOT = "M3MedicalClaimFactsIndex.selectStockInto";
const MEDICAL_CLAIM_FACT_RECEIVER_METHOD_MANIFEST = [
  [
    MEDICAL_CLAIM_FACT_ROOTS[0],
    [MEDICAL_CLAIM_FACT_ROOTS[0], "EntityRegistry.isIndexActive", "EntityRegistry.generationAt"],
  ],
  [MEDICAL_CLAIM_FACT_ROOTS[1], [MEDICAL_CLAIM_FACT_ROOTS[1]]],
] as const;
const REST_RECEIVER_MANIFEST = [
  [REST_ROOTS[0], ["JobCoreStore.createRunningJobScalarsInto"]],
  [REST_ROOTS[1], ["rollbackAndReleaseRunningAutonomyJobScalarsInto"]],
  [REST_ROOTS[2], []],
  [
    REST_ROOTS[3],
    ["JobCoreStore.readCommittedAutonomyJobInto", "JobCoreStore.enterAutonomyStepInto"],
  ],
  [
    REST_ROOTS[4],
    [
      "JobCoreStore.readCommittedAutonomyJobInto",
      "JobCoreStore.prepareAutonomyProgressScalarsInto",
      "NeedStore.prepareLaneDeltaInto",
    ],
  ],
  [
    REST_ROOTS[5],
    [
      "JobCoreStore.readCommittedAutonomyJobInto",
      "JobCoreStore.prepareAutonomyTerminalScalarsInto",
      "ReservationLedger.releaseClaimsInto",
    ],
  ],
  [
    REST_ROOTS[6],
    [
      "JobCoreStore.readCommittedAutonomyJobInto",
      "JobCoreStore.prepareAutonomyTerminalScalarsInto",
      "ReservationLedger.releaseClaimsInto",
    ],
  ],
] as const;
const REST_RECEIVER_OWNER_ALLOWLIST = [
  [REST_ROOTS[0], ["JobCoreStore", "RestJobDriverStore"]],
  [REST_ROOTS[1], ["JobCoreStore", "RestJobDriverStore"]],
  [REST_ROOTS[2], ["RestJobDriverStore"]],
  [REST_ROOTS[3], ["JobCoreStore", "RestJobDriverStore"]],
  [REST_ROOTS[4], ["JobCoreStore", "NeedStore", "RestJobDriverStore"]],
  [REST_ROOTS[5], ["JobCoreStore", "ReservationLedger", "RestJobDriverStore"]],
  [REST_ROOTS[6], ["JobCoreStore", "ReservationLedger", "RestJobDriverStore"]],
] as const;
const REST_RECEIVER_METHOD_ALLOWLIST = [
  [
    REST_ROOTS[0],
    [
      "JobCoreStore.createRunningJobScalarsInto",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.resetTokenOutput",
      "JobCoreStore.writeTokenOutput",
      "RestJobDriverStore.adoptExistingClaimsInto",
      "RestJobDriverStore.captureRestOrigin",
      "RestJobDriverStore.clearRestOrigin",
      "RestJobDriverStore.decrementTerminalCurrent",
      "RestJobDriverStore.hasReusableRestOriginCount",
      "RestJobDriverStore.isExactRestAdoptionPreflight",
      "RestJobDriverStore.isReusableRestSlot",
      "RestJobDriverStore.writeAdoptionSuccess",
    ],
  ],
  [
    REST_ROOTS[1],
    [
      "JobCoreStore.[JOB_CORE_ORIGIN_TERMINAL_MATCH]",
      "JobCoreStore.[JOB_CORE_ROLLBACK_RELEASE_COMMIT]",
      "JobCoreStore.clearFreeSlotPayload",
      "JobCoreStore.clearOriginShadow",
      "JobCoreStore.clearOwnerAutonomy",
      "JobCoreStore.matchesAutonomyToken",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.pushFreeAutonomyJobId",
      "JobCoreStore.readAutonomyJobTokenInto",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "JobCoreStore.resetTokenOutput",
      "JobCoreStore.restoreTombstoneOrigin",
      "JobCoreStore.writeTokenOutput",
      "RestJobDriverStore.clearRestOrigin",
      "RestJobDriverStore.clearRestRow",
      "RestJobDriverStore.incrementTerminalCurrent",
      "RestJobDriverStore.isExactRestRollbackPreflight",
      "RestJobDriverStore.restoreRestOriginOrClear",
      "RestJobDriverStore.rollbackNewlyAdoptedInto",
      "RestJobDriverStore.writeAdoptionSuccess",
    ],
  ],
  [REST_ROOTS[2], ["RestJobDriverStore.readAdoptedJobInto"]],
  [
    REST_ROOTS[3],
    [
      "JobCoreStore.enterAutonomyStepInto",
      "JobCoreStore.finishAutonomyMutationInto",
      "JobCoreStore.matchesAutonomyToken",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "JobCoreStore.validateAutonomyMutation",
      "RestJobDriverStore.beginAdoptedInto",
      "RestJobDriverStore.matchesCommittedRestActiveJob",
      "RestJobDriverStore.matchesCommittedRestRunningJob",
      "RestJobDriverStore.matchesRestAdoptedMutation",
      "RestJobDriverStore.writeRestMutationMetrics",
    ],
  ],
  [
    REST_ROOTS[4],
    [
      "JobCoreStore.[JOB_CORE_PROGRESS_COMMIT]",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.prepareAutonomyProgressScalarsInto",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "NeedStore.[NEED_CHANGED_COMMIT]",
      "NeedStore.[NEED_NOOP_COMMIT]",
      "NeedStore.isActorActive",
      "NeedStore.prepareLaneDeltaInto",
      "NeedStore.readLaneOwnerVersion",
      "NeedStore.readLaneValue",
      "RestJobDriverStore.commitRestRecoveryTail",
      "RestJobDriverStore.matchesCommittedRestActiveJob",
      "RestJobDriverStore.matchesCommittedRestNeedEffect",
      "RestJobDriverStore.matchesCommittedRestRunningJob",
      "RestJobDriverStore.matchesRestAdoptedMutation",
      "RestJobDriverStore.matchesRestNeedMutation",
      "RestJobDriverStore.tickAdoptedInto",
      "RestJobDriverStore.writeRestMutationMetrics",
    ],
  ],
  [
    REST_ROOTS[5],
    [
      "JobCoreStore.[JOB_CORE_TERMINAL_COMMIT]",
      "JobCoreStore.clearOriginShadow",
      "JobCoreStore.clearOwnerAutonomy",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.prepareAutonomyTerminalScalarsInto",
      "JobCoreStore.pushFreeAutonomyJobId",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "ReservationLedger.incrementChannelCount",
      "ReservationLedger.isOwner",
      "ReservationLedger.isValidClaimId",
      "ReservationLedger.readChannelCode",
      "ReservationLedger.releaseClaimNoVersion",
      "ReservationLedger.releaseClaimsInto",
      "ReservationLedger.resetReleaseClaimsIntoOutput",
      "ReservationLedger.unlinkOwner",
      "ReservationLedger.unlinkTarget",
      "ReservationLedger.validateExactClaimHeader",
      "ReservationLedger.validateExactClaimPrefix",
      "RestJobDriverStore.clearRestOrigin",
      "RestJobDriverStore.commitRestTerminalTail",
      "RestJobDriverStore.hasRestLedgerReleaseHeadroom",
      "RestJobDriverStore.hasRestTerminalHeadroom",
      "RestJobDriverStore.incrementTerminalCurrent",
      "RestJobDriverStore.isRestTerminalDuplicate",
      "RestJobDriverStore.matchesCommittedRestActiveJob",
      "RestJobDriverStore.matchesRestAdoptedMutation",
      "RestJobDriverStore.persistRestCleanupPending",
      "RestJobDriverStore.prepareRestTerminal",
      "RestJobDriverStore.releaseRestClaims",
      "RestJobDriverStore.terminalAdoptedInto",
      "RestJobDriverStore.writeRestMutationMetrics",
    ],
  ],
  [
    REST_ROOTS[6],
    [
      "JobCoreStore.[JOB_CORE_TERMINAL_COMMIT]",
      "JobCoreStore.clearOriginShadow",
      "JobCoreStore.clearOwnerAutonomy",
      "JobCoreStore.matchesAutonomyTokenScalars",
      "JobCoreStore.prepareAutonomyTerminalScalarsInto",
      "JobCoreStore.pushFreeAutonomyJobId",
      "JobCoreStore.readCommittedAutonomyJobInto",
      "ReservationLedger.incrementChannelCount",
      "ReservationLedger.isOwner",
      "ReservationLedger.isValidClaimId",
      "ReservationLedger.readChannelCode",
      "ReservationLedger.releaseClaimNoVersion",
      "ReservationLedger.releaseClaimsInto",
      "ReservationLedger.resetReleaseClaimsIntoOutput",
      "ReservationLedger.unlinkOwner",
      "ReservationLedger.unlinkTarget",
      "ReservationLedger.validateExactClaimHeader",
      "ReservationLedger.validateExactClaimPrefix",
      "RestJobDriverStore.clearRestOrigin",
      "RestJobDriverStore.commitRestTerminalTail",
      "RestJobDriverStore.hasRestLedgerReleaseHeadroom",
      "RestJobDriverStore.hasRestTerminalHeadroom",
      "RestJobDriverStore.incrementTerminalCurrent",
      "RestJobDriverStore.matchesCommittedRestActiveJob",
      "RestJobDriverStore.matchesRestAdoptedMutation",
      "RestJobDriverStore.prepareRestTerminal",
      "RestJobDriverStore.releaseRestClaims",
      "RestJobDriverStore.resumeCleanupInto",
      "RestJobDriverStore.writeRestMutationMetrics",
    ],
  ],
] as const;
const REST_FORBIDDEN_RECEIVERS = [
  "JobCoreStore.createJob",
  "JobCoreStore.enterStep",
  "JobCoreStore.tickJob",
  "JobCoreStore.tickAutonomyJobInto",
  "JobCoreStore.completeJob",
  "JobCoreStore.cancelJob",
  "JobCoreStore.failJob",
  "JobCoreStore.requestInterruption",
  "JobCoreStore.rollbackRunningAutonomyJobInto",
  "JobCoreStore.releaseReservedAutonomyJobTokenInto",
  "JobCoreStore.releaseReservedAutonomyJobScalarsInto",
  "JobCoreStore.setAutonomyCarriedStateInto",
  "ReservationLedger.releaseClaims",
  "NeedStore.applyLaneDelta",
] as const;
const PROJECT_MARKER = "/packages/sim-core/src/";
const FORBIDDEN_CALLS = new Set([
  "concat",
  "every",
  "filter",
  "find",
  "findIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "slice",
  "some",
  "sort",
]);
const INTERNAL_COMMIT_APPROVALS = [
  ["ITEM_STACK_COMMIT", "ItemStackStore"],
  ["JOB_CORE_CARRIED_COMMIT", "JobCoreStore"],
  ["JOB_CORE_TERMINAL_COMMIT", "JobCoreStore"],
  ["JOB_CORE_PROGRESS_COMMIT", "JobCoreStore"],
  ["JOB_CORE_ROLLBACK_RELEASE_COMMIT", "JobCoreStore"],
  ["JOB_CORE_ORIGIN_TERMINAL_MATCH", "JobCoreStore"],
  ["M3_HEALTH_TREATMENT_COMMIT", "M3HealthConditionStore"],
  ["M4_LAMP_COMMIT", "M4LampNetworkStore"],
  ["NEED_CHANGED_COMMIT", "NeedStore"],
  ["NEED_NOOP_COMMIT", "NeedStore"],
  ["NEED_URGENCY_MARK_DIRTY", "NeedUrgencyIndex"],
  ["STORAGE_DIRTY_APPEND_COMMIT", "StorageLogisticsIndex"],
  ["STORAGE_DIRTY_COALESCE_COMMIT", "StorageLogisticsIndex"],
] as const;

interface AuditResult {
  readonly reached: ReadonlySet<string>;
  readonly reachedDeclarations: ReadonlySet<ts.SignatureDeclaration>;
  readonly violations: readonly string[];
  readonly callCounts: ReadonlyMap<string, number>;
  readonly receiverOwners: ReadonlySet<string>;
  readonly receiverMethods: ReadonlySet<string>;
}

interface InternalCommitApproval {
  readonly key: ts.Symbol;
  readonly owner: ts.ClassDeclaration;
}

describe("owner autonomy adoption receiver-exact closure", () => {
  it("roots the allocation-free Hauling mapping read through only its exact owner receiver", () => {
    const result = auditProjectRoot(HAULING_MAPPING_ROOT, true, true);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set([HAULING_MAPPING_ROOT]));
    expect(result.reached.has("resetHaulingClaimMappingOutput")).toBe(true);
    expect(result.reached.has("isUint32")).toBe(true);
    for (const forbidden of [
      "HaulingClaimFactsIndex.createSnapshot",
      "HaulingClaimFactsIndex.readClaimFactsInto",
      "WorkOfferIndex.readOfferInto",
      "StorageLogisticsIndex.readSlotInto",
      "ItemStackStore.readStackInto",
      "ReservationLedger.readActiveClaimsInto",
    ]) {
      expect(result.reached.has(forbidden)).toBe(false);
    }
  });

  it("rejects a fake cast receiver for the Hauling mapping read", () => {
    const result = auditSyntheticAccessorRoot(
      `class HaulingClaimFactsIndex { readMappingInto(): void {} }
       function root(value: unknown): void {
         (value as HaulingClaimFactsIndex).readMappingInto();
       }`,
    );
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("roots the formal Hauling resolver through exact owner receivers allocation-free", () => {
    const result = auditProjectRoot(ROOT);
    expect(result.violations).toStrictEqual([]);
    expect(result.reached.has(ROOT)).toBe(true);
    expect(result.reached.has("WorkOfferIndex.readOfferInto")).toBe(true);
    expect(result.reached.has("StorageLogisticsIndex.readSlotInto")).toBe(true);
    expect(result.reached.has("ItemStackStore.readStackInto")).toBe(true);
  });

  it.each(HAULING_ROOTS)("audits the receiver-exact allocation-free %s closure", (root) => {
    const result = auditProjectRoot(root);
    expect(result.violations).toStrictEqual([]);
    expect(result.reached.has(root)).toBe(true);
  });

  it.each(REST_ROOTS)("audits the receiver-exact allocation-free %s closure", (root) => {
    const result = auditProjectRoot(root);
    expect(result.violations).toStrictEqual([]);
    expect(result.reached.has(root)).toBe(true);
  });

  it.each(HEALTH_ROOTS)("audits the allocation-free Health owner seam %s", (root) => {
    const result = auditProjectRoot(root);
    expect(result.violations).toStrictEqual([]);
    expect([...result.receiverMethods]).toStrictEqual([root]);
  });

  it.each(STORAGE_OWNER_RECEIVER_MANIFEST)(
    "audits the exact allocation-free Storage owner root %s",
    (root, expectedReceiverMethods) => {
      const result = auditProjectRoot(root, true, true);
      expect(result.violations).toStrictEqual([]);
      expect(result.reached.has(root)).toBe(true);
      expect(result.receiverMethods).toStrictEqual(new Set(expectedReceiverMethods));
      for (const forbidden of [
        "StorageLogisticsIndex.selectSupplySlots",
        "StorageLogisticsIndex.selectCandidateSlots",
        "StorageLogisticsIndex.readSlot",
        "commitPreparedStorageSlotDirty",
      ]) {
        expect(result.reached.has(forbidden)).toBe(false);
      }
    },
  );

  it.each([
    [STORAGE_COMMIT_ROOTS[0], "StorageLogisticsIndex.[STORAGE_DIRTY_APPEND_COMMIT]"],
    [STORAGE_COMMIT_ROOTS[1], "StorageLogisticsIndex.[STORAGE_DIRTY_COALESCE_COMMIT]"],
  ] as const)("audits the exact Storage commit bridge %s", (root, receiverMethod) => {
    const result = auditProjectFunction(root);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set([receiverMethod]));
  });

  it.each(LAMP_ROOTS)("audits the exact allocation-free Lamp owner root %s", (root) => {
    const result = auditProjectRoot(root, true, true);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set([root]));
    for (const forbidden of [
      "M4LampNetworkStore.readLamp",
      "M4LampNetworkStore.setRuleFields",
      "M4LampNetworkStore.createSnapshot",
    ]) {
      expect(result.reached.has(forbidden)).toBe(false);
    }
  });

  it("limits the Lamp commit bridge to its unique-symbol receiver", () => {
    const result = auditProjectFunction(LAMP_COMMIT_BRIDGE);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set(["M4LampNetworkStore.[M4_LAMP_COMMIT]"]));
  });

  it("keeps Lamp commit authority outside the package root and public instance", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const moduleExports = checker.getExportsOfModule(moduleSymbol);
    for (const publicName of [
      "createM4LampNetworkHashFields",
      "M4LampOperationReason",
      "M4LampIntoOutput",
      "M4LampPrepareInput",
      "PreparedM4LampMutation",
    ]) {
      expect(moduleExports.some((symbol) => symbol.name === publicName)).toBe(true);
    }
    expect(moduleExports.some((symbol) => symbol.name === LAMP_COMMIT_BRIDGE)).toBe(false);
    expect(moduleExports.some((symbol) => symbol.name === "restoreM4LampNetworkStore")).toBe(false);
    const publicLamp = moduleExports.find((symbol) => symbol.name === "M4LampNetworkStore");
    const lamp =
      publicLamp !== undefined && (publicLamp.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(publicLamp)
        : publicLamp;
    if (lamp?.valueDeclaration === undefined) throw new Error("missing public Lamp store");
    const instance = checker.getDeclaredTypeOfSymbol(lamp);
    expect(instance.getProperty("commitPreparedRefillOrMaintenance")).toBeUndefined();
    expect(instance.getProperty(LAMP_COMMIT_BRIDGE)).toBeUndefined();
  });

  it("routes GameSession Lamp authority through the canonical helper exactly once", () => {
    const declaration = findProjectFunction(createProgram(), "appendLamp");
    const body = declaration.body;
    if (body === undefined) throw new Error("missing appendLamp body");
    const file = ts.sys.readFile("packages/sim-core/src/game-session-hash-owner-fields.ts");
    if (file === undefined) throw new Error("missing GameSession owner hash source");
    const source = file.slice(body.pos, body.end);
    expect(source.match(/createM4LampNetworkHashFields/g)).toHaveLength(1);
    expect(source).not.toContain("snapshot.dirtyReasons");
    expect(source).not.toContain("snapshot.dirtyQueue");
  });

  it.each([
    ["object", "function invoke(owner: Owner): void { void {}; owner[APPROVED](); }"],
    ["array", "function invoke(owner: Owner): void { void []; owner[APPROVED](); }"],
    ["new", "function invoke(owner: Owner): void { void new Set(); owner[APPROVED](); }"],
    [
      "closure",
      "function invoke(owner: Owner): void { const f = (): void => {}; f(); owner[APPROVED](); }",
    ],
    [
      "for-of",
      "function invoke(owner: Owner): void { for (const value of [owner]) value[APPROVED](); }",
    ],
    ["while", "function invoke(owner: Owner): void { while (false) owner[APPROVED](); }"],
    ["do", "function invoke(owner: Owner): void { do owner[APPROVED](); while (false); }"],
  ] as const)("rejects Lamp synthetic %s hot-path violations", (_label, source) => {
    expect(auditSyntheticRoot(source).violations.length).toBeGreaterThan(0);
  });

  it.each(["M4LampNetworkStore.readLamp", "M4LampNetworkStore.setRuleFields"])(
    "rejects materializing Lamp owner root %s",
    (root) => {
      const result = auditProjectRoot(root, true, true);
      expect(result.violations.some((violation) => violation.includes("literal allocation"))).toBe(
        true,
      );
    },
  );

  it.each([
    [
      ITEM_STACK_ROOTS[0],
      [
        "ItemStackStore.readStackInto",
        "ReservationLedger.reservedAmountForItem",
        "ReservationLedger.version",
      ],
    ],
    [
      ITEM_STACK_ROOTS[1],
      [
        "ItemStackStore.isActiveStackId",
        "ItemStackStore.prepareAutonomousQuantityRemovalInto",
        "ReservationLedger.reservedAmountForItem",
        "ReservationLedger.version",
      ],
    ],
    [
      ITEM_STACK_ROOTS[2],
      [
        "ItemStackStore.isActiveStackId",
        "ItemStackStore.prepareAutonomousQuantityAdditionInto",
        "ReservationLedger.version",
      ],
    ],
  ] as const)("audits exact allocation-free ItemStack root %s", (root, receiverMethods) => {
    const result = auditProjectRoot(root, true, true);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set(receiverMethods));
    for (const forbidden of [
      "ItemStackStore.readStack",
      "ItemStackStore.readEntity",
      "ReservationLedger.acquire",
      "ReservationLedger.releaseClaimsInto",
      "ReservationLedger.readActiveClaimsInto",
    ]) {
      expect(result.reached.has(forbidden)).toBe(false);
    }
  });

  it.each(ITEM_STACK_COMMIT_ROOTS)(
    "limits ItemStack internal bridge %s to commit-only authority",
    (root) => {
      const result = auditProjectFunction(root);
      expect(result.violations).toStrictEqual([]);
      expect(result.receiverMethods).toStrictEqual(new Set(["ItemStackStore.[ITEM_STACK_COMMIT]"]));
    },
  );

  it("exports the prepared ItemStack type without exposing commit authority", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const names: string[] = [];
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) names.push(symbol.name);
    expect(names).toContain("PreparedItemStackQuantityRemoval");
    expect(names).not.toContain("commitPreparedItemStackQuantityRemoval");
    expect(names).not.toContain("commitPreparedItemStackQuantityAddition");
    const itemSource = program
      .getSourceFiles()
      .find((source) =>
        normalize(source.fileName).endsWith("/packages/sim-core/src/item-stack-store.ts"),
      );
    const store = itemSource?.statements.find(
      (statement): statement is ts.ClassDeclaration =>
        ts.isClassDeclaration(statement) && statement.name?.text === "ItemStackStore",
    );
    if (store === undefined) throw new Error("missing ItemStackStore declaration");
    expect(store.members.some((member) => member.name?.getText().startsWith("commit"))).toBe(false);
  });

  it("exports only the public Storage supply Into query contract", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const moduleExports = checker.getExportsOfModule(moduleSymbol);
    for (const publicName of [
      "STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES",
      "PreparedStorageSlotDirty",
      "StorageSlotDirtyPrepareInput",
      "StorageSlotIntoOutput",
      "StorageLogisticsRefreshResult",
      "StorageLogisticsSnapshot",
      "StorageSupplySelectionScratch",
      "StorageSupplySelectionIntoOutput",
    ]) {
      expect(moduleExports.some((symbol) => symbol.name === publicName)).toBe(true);
    }
    for (const privateName of [
      "commitPreparedStorageDirtyAppend",
      "commitPreparedStorageDirtyCoalesce",
      "commitPreparedStorageSlotDirty",
    ]) {
      expect(moduleExports.some((symbol) => symbol.name === privateName)).toBe(false);
    }
  });

  it.each(MEDICAL_CLAIM_FACT_RECEIVER_METHOD_MANIFEST)(
    "audits the exact allocation-free Medical claim-facts root %s",
    (root, expectedReceiverMethods) => {
      const result = auditProjectRoot(root);
      expect(result.violations).toStrictEqual([]);
      expect(result.reached.has(root)).toBe(true);
      expect([...result.receiverMethods]).toStrictEqual(expectedReceiverMethods);
      for (const forbidden of [
        "M3MedicalClaimFactsIndex.createSnapshot",
        "M3MedicalClaimFactsIndex.restoreFromSnapshot",
        "M3MedicalClaimFactsIndex.registerPatientInteraction",
      ]) {
        expect(result.reached.has(forbidden)).toBe(false);
      }
    },
  );

  it("audits the accessor-aware bounded Medical stock root", () => {
    const result = auditProjectRoot(MEDICAL_STOCK_ROOT, true, true);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(
      new Set([
        "M3MedicalClaimFactsIndex.selectStockInto",
        "StorageLogisticsIndex.selectSupplySlotsInto",
        "StorageLogisticsIndex.captureSupplySelection",
        "StorageLogisticsIndex.matchesCapturedSupplySelection",
        "StorageLogisticsIndex.readSlotInto",
        "StorageLogisticsIndex.findDirtyQueueIndex",
        "ItemStackStore.readStackInto",
        "ItemStackStore.version",
        "ReservationLedger.version",
        "ReservationLedger.reservedAmountForItem",
        "EntityRegistry.isIndexActive",
        "EntityRegistry.generationAt",
      ]),
    );
    for (const forbidden of [
      "StorageLogisticsIndex.selectSupplySlots",
      "StorageLogisticsIndex.selectCandidateSlots",
      "StorageLogisticsIndex.readSlot",
      "ItemStackStore.readStack",
      "ItemStackStore.readEntity",
      "EntityRegistry.validate",
      "EntityRegistry.isAlive",
      "EntityRegistry.forEachAliveAscending",
      "ReservationLedger.readRecord",
      "ReservationLedger.readActiveClaimsInto",
      "ReservationLedger.acquire",
      "ReservationLedger.releaseClaimsInto",
      "ReservationLedger.createSnapshot",
      "ReservationLedger.createMetrics",
      "M3MedicalClaimFactsIndex.createSnapshot",
      "M3MedicalClaimFactsIndex.restoreFromSnapshot",
      "M3MedicalClaimFactsIndex.registerPatientInteraction",
      "M3MedicalClaimFactsIndex.readTreatmentPolicyInto",
      "M3MedicalClaimFactsIndex.readPatientInteractionInto",
    ]) {
      expect(result.reached.has(forbidden)).toBe(false);
    }
  });

  it.each([
    [
      "allocating getter",
      `class Owner { get value(): Uint8Array { return new Uint8Array(1); } }
       function root(owner: Owner): void { void owner.value; }`,
    ],
    [
      "unresolved getter",
      `class Owner { get value(): number { return 1; } }
       function root(owner: Owner): void { void owner.missing; }`,
    ],
    [
      "dynamic getter",
      `class Owner { get value(): number { return 1; } }
       function root(owner: Owner, key: string): void { void owner[key]; }`,
    ],
  ])("rejects %s through the accessor-aware auditor", (_label, source) => {
    expect(auditSyntheticAccessorRoot(source).violations.length).toBeGreaterThan(0);
  });

  it("exposes a foreign getter to the exact receiver manifest", () => {
    const result = auditSyntheticAccessorRoot(
      `class Owner { get value(): number { return 1; } }
       class Foreign { get value(): number { return 2; } }
       function root(owner: Owner, foreign: Foreign): void { void owner.value; void foreign.value; }`,
    );
    expect(result.receiverMethods).not.toStrictEqual(new Set(["Owner.value"]));
    expect(result.receiverMethods.has("Foreign.value")).toBe(true);
  });

  it("rejects an inherited getter reached through a foreign receiver declaration", () => {
    const result = auditSyntheticAccessorRoot(
      `class Owner { get value(): number { return 1; } }
       class Foreign extends Owner {}
       function root(foreign: Foreign): void { void foreign.value; }`,
    );
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("resolves a static literal bracket getter without treating it as dynamic", () => {
    const result = auditSyntheticAccessorRoot(
      `class Owner { get value(): number { return 1; } }
       function root(owner: Owner): void { void owner["value"]; }`,
    );
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set(["Owner.value"]));
  });

  it("exports the Medical interaction/policy contract without mutation bridges", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const moduleExports = checker.getExportsOfModule(moduleSymbol);
    for (const publicName of [
      "M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION",
      "M3_MEDICAL_TREATMENT_POLICY_KIND",
      "M3_MEDICAL_TREATMENT_POLICY_VERSION",
      "M3MedicalClaimFactsIndex",
      "createM3MedicalClaimFactsHashFields",
      "createM3MedicalClaimFactsIndex",
      "M3MedicalClaimFactsIndexOptions",
      "M3MedicalClaimFactsReason",
      "M3MedicalClaimFactsRestoreReason",
      "M3MedicalClaimFactsRestoreResult",
      "M3MedicalClaimFactsSnapshot",
      "M3MedicalClaimFactsSnapshotInput",
      "M3MedicalPatientInteractionSnapshotRow",
      "M3MedicalPatientInteractionInput",
      "M3MedicalPatientInteractionIntoOutput",
      "M3MedicalTreatmentPolicyInput",
      "M3MedicalTreatmentPolicyIntoOutput",
      "M3MedicalStockSelectionInput",
      "M3MedicalStockSelectionScratch",
      "M3MedicalStockSelectionIntoOutput",
    ]) {
      expect(moduleExports.some((symbol) => symbol.name === publicName)).toBe(true);
    }
    for (const forbidden of [
      "commitPreparedM3MedicalClaimFacts",
      "restoreM3MedicalClaimFactsIndex",
      "updateM3MedicalPatientInteraction",
      "removeM3MedicalPatientInteraction",
      "updatePatientInteraction",
      "removePatientInteraction",
    ]) {
      expect(moduleExports.some((symbol) => symbol.name === forbidden)).toBe(false);
    }
    const publicIndex = moduleExports.find((symbol) => symbol.name === "M3MedicalClaimFactsIndex");
    const medicalIndex =
      publicIndex !== undefined && (publicIndex.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(publicIndex)
        : publicIndex;
    if (medicalIndex?.valueDeclaration === undefined)
      throw new Error("missing public M3MedicalClaimFactsIndex declaration");
    const instance = checker.getDeclaredTypeOfSymbol(medicalIndex);
    for (const property of instance.getProperties()) {
      expect(property.name.startsWith("commit")).toBe(false);
    }
    for (const forbidden of [
      "updateM3MedicalPatientInteraction",
      "removeM3MedicalPatientInteraction",
      "updatePatientInteraction",
      "removePatientInteraction",
      "restoreM3MedicalClaimFactsIndex",
    ]) {
      expect(instance.getProperty(forbidden)).toBeUndefined();
    }
  });

  it("audits the unique-symbol Health treatment commit bridge", () => {
    const result = auditProjectFunction(HEALTH_COMMIT_BRIDGE);
    expect(result.violations).toStrictEqual([]);
    expect([...result.receiverMethods]).toStrictEqual([
      "M3HealthConditionStore.[M3_HEALTH_TREATMENT_COMMIT]",
    ]);
  });

  it("keeps the Health treatment commit outside the package root and public instance", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const moduleExports = checker.getExportsOfModule(moduleSymbol);
    for (const publicType of [
      "M3HealthConditionIntoOutput",
      "M3HealthTreatmentConditionDeltaPrepareInput",
      "M3HealthTreatmentPrepareReason",
      "PreparedM3HealthTreatmentConditionDelta",
    ]) {
      expect(moduleExports.some((symbol) => symbol.name === publicType)).toBe(true);
    }
    expect(moduleExports.some((symbol) => symbol.name === HEALTH_COMMIT_BRIDGE)).toBe(false);
    const publicHealth = moduleExports.find((symbol) => symbol.name === "M3HealthConditionStore");
    const health =
      publicHealth !== undefined && (publicHealth.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(publicHealth)
        : publicHealth;
    if (health?.valueDeclaration === undefined) {
      throw new Error("missing public M3HealthConditionStore declaration");
    }
    const instance = checker.getDeclaredTypeOfSymbol(health);
    expect(instance.getProperty(HEALTH_COMMIT_BRIDGE)).toBeUndefined();
    expect(instance.getProperty("commitPreparedM3HealthTreatment")).toBeUndefined();
  });

  it.each(REST_RECEIVER_MANIFEST)(
    "enforces the reviewed receiver manifest for %s",
    (root, required) => {
      const result = auditProjectRoot(root);
      for (const label of required) expect(result.reached.has(label)).toBe(true);
      for (const label of REST_FORBIDDEN_RECEIVERS) expect(result.reached.has(label)).toBe(false);
    },
  );

  it.each(TREATMENT_A_ROOTS)("keeps Treatment-A root %s allocation-free", (root) => {
    const result = auditProjectRoot(root, true, true);
    expect(result.violations).toStrictEqual([]);
    for (const forbidden of TREATMENT_A_FORBIDDEN)
      expect(result.reached.has(forbidden)).toBe(false);
    if (root === TREATMENT_A_ROOTS[0]) {
      expect(result.callCounts.get("JobCoreStore.createRunningJobScalarsInto")).toBe(1);
    } else if (root === TREATMENT_A_ROOTS[1]) {
      expect(result.callCounts.get("JobCoreStore.rollbackRunningAutonomyJobScalarsInto")).toBe(1);
    } else {
      expect(result.receiverOwners).toStrictEqual(new Set(["M3TreatmentJobStore"]));
    }
  });

  it.each(TREATMENT_A_RECEIVER_METHODS)(
    "freezes the exact Treatment-A receiver set for %s",
    (root, methods) => {
      expect(auditProjectRoot(root, true, true).receiverMethods).toStrictEqual(new Set(methods));
    },
  );

  it.each(TREATMENT_B_ROOTS)("keeps Treatment-B root %s allocation-free", (root) => {
    const result = auditProjectRoot(root, true, true);
    expect(result.violations).toStrictEqual([]);
    for (const forbidden of TREATMENT_B_FORBIDDEN)
      expect(result.reached.has(forbidden)).toBe(false);
    expect(result.reached.has("JobCoreStore.readCommittedAutonomyJobInto")).toBe(true);
    if (root === TREATMENT_B_ROOTS[0]) {
      expect(result.reached.has("JobCoreStore.enterAutonomyStepInto")).toBe(false);
      expect(result.reached.has("JobCoreStore.prepareAutonomyProgressScalarsInto")).toBe(false);
    } else if (root === TREATMENT_B_ROOTS[1]) {
      expect(result.callCounts.get("JobCoreStore.enterAutonomyStepInto")).toBe(1);
    } else {
      expect(result.callCounts.get("JobCoreStore.prepareAutonomyProgressScalarsInto")).toBe(1);
      expect(result.reached.has("JobCoreStore.[JOB_CORE_PROGRESS_COMMIT]")).toBe(true);
    }
  });

  it.each(TREATMENT_B_RECEIVER_METHODS)(
    "freezes the exact Treatment-B receiver set for %s",
    (root, methods) => {
      expect(auditProjectRoot(root, true, true).receiverMethods).toStrictEqual(new Set(methods));
    },
  );

  it.each(TREATMENT_C_ROOTS)(
    "keeps Treatment-C root %s receiver-exact and allocation-free",
    (root) => {
      const result = auditProjectRoot(root, true, true);
      expect(result.violations).toStrictEqual([]);
      for (const forbidden of TREATMENT_C_FORBIDDEN)
        expect(result.reached.has(forbidden)).toBe(false);
      expect(result.reached.has("JobCoreStore.readCommittedAutonomyJobInto")).toBe(true);
      expect(result.reached.has("JobCoreStore.prepareAutonomyTerminalScalarsInto")).toBe(true);
      expect(result.reached.has("JobCoreStore.[JOB_CORE_TERMINAL_COMMIT]")).toBe(true);
      expect(result.reached.has("ReservationLedger.readActiveClaimsInto")).toBe(true);
      expect(result.reached.has("ReservationLedger.releaseClaimsInto")).toBe(true);
      if (root === TREATMENT_C_ROOTS[0]) {
        expect(result.reached.has("M3HealthConditionStore.readConditionInto")).toBe(true);
        expect(
          result.reached.has("M3HealthConditionStore.prepareTreatmentConditionDeltaInto"),
        ).toBe(true);
        expect(result.reached.has("M3HealthConditionStore.[M3_HEALTH_TREATMENT_COMMIT]")).toBe(
          true,
        );
        expect(result.reached.has("ItemStackStore.readStackInto")).toBe(true);
        expect(result.reached.has("ItemStackStore.[ITEM_STACK_COMMIT]")).toBe(true);
        expect(result.reached.has("StorageLogisticsIndex.readSlotInto")).toBe(true);
        expect(result.reached.has("StorageLogisticsIndex.prepareSlotDirtyInto")).toBe(true);
        expect(result.reached.has("StorageLogisticsIndex.[STORAGE_DIRTY_APPEND_COMMIT]")).toBe(
          true,
        );
        expect(result.reached.has("StorageLogisticsIndex.[STORAGE_DIRTY_COALESCE_COMMIT]")).toBe(
          true,
        );
      } else {
        expect(result.reached.has("M3HealthConditionStore.readConditionInto")).toBe(false);
        expect(result.reached.has("ItemStackStore.readStackInto")).toBe(false);
        expect(result.reached.has("StorageLogisticsIndex.readSlotInto")).toBe(false);
      }
    },
  );

  it.each(TREATMENT_C_RECEIVER_METHODS)(
    "freezes the exact Treatment-C receiver set for %s",
    (root, methods) => {
      expect(auditProjectRoot(root, true, true).receiverMethods).toStrictEqual(new Set(methods));
    },
  );

  it.each([
    [
      "async and await",
      `async function invoke(receiver: Owner): Promise<void> {
        await Promise.resolve(); receiver[APPROVED]();
      }`,
    ],
    [
      "callback combinator",
      `function invoke(receiver: Owner): void {
        [receiver].forEach((value): void => value[APPROVED]());
      }`,
    ],
  ] as const)("rejects Treatment closure %s", (_label, body) => {
    expect(auditSyntheticRoot(body).violations.length).toBeGreaterThan(0);
  });

  it.each(REST_RECEIVER_OWNER_ALLOWLIST)(
    "enforces the exact receiver-owner allowlist for %s",
    (root, expectedOwners) => {
      const result = auditProjectRoot(root);
      expect(result.receiverOwners).toStrictEqual(new Set(expectedOwners));
    },
  );

  it.each(REST_RECEIVER_METHOD_ALLOWLIST)(
    "enforces the exact receiver-method allowlist for %s",
    (root, expectedMethods) => {
      const result = auditProjectRoot(root);
      expect(result.receiverMethods).toStrictEqual(new Set(expectedMethods));
    },
  );

  it("keeps rollback and origin-match bridges outside the package-root JobCore surface", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const exports = new Set<string>();
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) exports.add(symbol.name);
    expect(exports.has("rollbackAndReleaseRunningAutonomyJobScalarsInto")).toBe(false);
    expect(exports.has("matchesAutonomyOriginTerminalScalars")).toBe(false);
    const publicJobCore = exports.has("JobCoreStore")
      ? checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === "JobCoreStore")
      : undefined;
    const jobCore =
      publicJobCore !== undefined && (publicJobCore.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(publicJobCore)
        : publicJobCore;
    const declaration = jobCore?.valueDeclaration;
    if (jobCore === undefined || declaration === undefined) {
      throw new Error("missing public JobCoreStore declaration");
    }
    const instance = checker.getDeclaredTypeOfSymbol(jobCore);
    expect(instance.getProperty("rollbackAndReleaseRunningAutonomyJobScalarsInto")).toBeUndefined();
    expect(instance.getProperty("matchesAutonomyOriginTerminalScalars")).toBeUndefined();
  });

  it.each([
    [
      REST_ROOTS[0],
      ["isExactRestAdoptionPreflight", "createRunningJobScalarsInto", "captureRestOrigin"],
    ],
    [
      REST_ROOTS[1],
      [
        "isExactRestRollbackPreflight",
        "rollbackAndReleaseRunningAutonomyJobScalarsInto",
        "restoreRestOriginOrClear",
      ],
    ],
    [REST_ROOTS[3], ["matchesCommittedRestActiveJob", "enterAutonomyStepInto"]],
    [
      REST_ROOTS[4],
      [
        "prepareAutonomyProgressScalarsInto",
        "prepareLaneDeltaInto",
        "commitPreparedChangedNeedLaneMutation",
        "commitRestRecoveryTail",
      ],
    ],
    [
      REST_ROOTS[5],
      [
        "prepareRestTerminal",
        "releaseRestClaims",
        "persistRestCleanupPending",
        "commitRestTerminalTail",
      ],
    ],
    [REST_ROOTS[6], ["prepareRestTerminal", "releaseRestClaims", "commitRestTerminalTail"]],
  ] as const)("freezes prepare/commit ordering for %s", (root, orderedCalls) => {
    const method = findProjectMethod(createProgram(), root);
    const body = method.body;
    const source = ts.sys.readFile("packages/sim-core/src/m3-rest-sleep.ts") ?? "";
    const text = body === undefined ? "" : source.slice(body.pos, body.end);
    let previous = -1;
    for (const call of orderedCalls) {
      const next = text.indexOf(call);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });

  it.each(["HaulingJobStore.pickupAdoptedInto", "HaulingJobStore.terminalAdoptedInto"])(
    "%s performs exactly one bounded ReservationLedger claim read",
    (root) => {
      const result = auditProjectRoot(root);
      expect(result.callCounts.get("ReservationLedger.readActiveClaimsInto")).toBe(1);
    },
  );

  it.each([
    [
      "same-name shadow",
      `function invoke(receiver: Owner): void {
      const APPROVED = Symbol("commit"); receiver[APPROVED]();
    }`,
    ],
    [
      "same-description foreign symbol",
      `const FOREIGN = Symbol("commit");
      class ForeignKeyOwner { [FOREIGN](): void {} }
      function invoke(receiver: ForeignKeyOwner): void { receiver[FOREIGN](); }`,
    ],
    [
      "cast receiver",
      `function invoke(value: unknown): void {
      (value as Owner)[APPROVED]();
    }`,
    ],
    [
      "conditional receiver",
      `function invoke(left: Owner, right: Owner, flag: boolean): void {
      (flag ? left : right)[APPROVED]();
    }`,
    ],
    [
      "factory receiver",
      `function make(value: Owner): Owner { return value; }
      function invoke(receiver: Owner): void { make(receiver)[APPROVED](); }`,
    ],
    [
      "dynamic key",
      `function invoke(receiver: Owner): void {
      const key = APPROVED; receiver[key]();
    }`,
    ],
    [
      "foreign owner",
      `class ForeignOwner { [APPROVED](): void {} }
      function invoke(receiver: ForeignOwner): void { receiver[APPROVED](); }`,
    ],
  ] as const)("rejects %s through the formal receiver auditor", (_label, body) => {
    const result = auditSyntheticRoot(body);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it.each(NEED_OWNER_ROOTS)("audits the allocation-free Need owner root %s", (root) => {
    const result = auditProjectRoot(root);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(new Set([root]));
  });

  it.each(NEED_COMMIT_ROOTS)("limits Need internal bridge %s to commit-only authority", (root) => {
    const result = auditProjectFunction(root);
    expect(result.violations).toStrictEqual([]);
    expect(result.receiverMethods).toStrictEqual(
      new Set([
        root === NEED_COMMIT_ROOTS[0]
          ? "NeedStore.[NEED_CHANGED_COMMIT]"
          : "NeedStore.[NEED_NOOP_COMMIT]",
      ]),
    );
  });

  it("freezes scheduled Need preflight, commit, and mirror ordering", () => {
    const method = findProjectMethod(createProgram(), "NeedStore.processScheduledUpdates");
    const body = method.body;
    const source = ts.sys.readFile("packages/sim-core/src/m3-needs.ts") ?? "";
    const text = body === undefined ? "" : source.slice(body.pos, body.end);
    const preflight = text.indexOf("this.storeVersion > 0xffff_ffff - changed");
    const firstWrite = text.indexOf("this.values[key] = nextValue");
    const cursorWrite = text.indexOf("this.scheduleCursors[phase] =");
    const updateCounterWrite = text.indexOf("this.scheduledUpdateCount += visited");
    const changeCounterWrite = text.indexOf("this.scheduledChangeCount += changed");
    const lastVisitedWrite = text.indexOf("this.lastScheduledVisitedCount = visited");
    const mirrorWrite = text.indexOf("this.publishScheduledDirty(dirtySink, changed)");
    const sinkType = method.parameters[3]?.type;
    expect(
      sinkType !== undefined &&
        ts.isTypeReferenceNode(sinkType) &&
        ts.isIdentifier(sinkType.typeName)
        ? sinkType.typeName.text
        : undefined,
    ).toBe("NeedUrgencyIndex");
    expect(preflight).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(preflight);
    expect(cursorWrite).toBeGreaterThan(firstWrite);
    expect(updateCounterWrite).toBeGreaterThan(cursorWrite);
    expect(changeCounterWrite).toBeGreaterThan(updateCounterWrite);
    expect(lastVisitedWrite).toBeGreaterThan(changeCounterWrite);
    expect(mirrorWrite).toBeGreaterThan(lastVisitedWrite);
    for (const forbidden of [
      "readActorNeeds(",
      "readLaneLastChange(",
      ".map(",
      ".filter(",
      "new ",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("audits scheduled Need mirror delivery through its allocation-free internal receiver", () => {
    const result = auditProjectRoot("NeedStore.processScheduledUpdates");
    expect(result.reached).toContain("NeedUrgencyIndex.[NEED_URGENCY_MARK_DIRTY]");
    expect(result.receiverMethods).toStrictEqual(
      new Set([
        "NeedStore.isExactScheduledCursorBasis",
        "NeedStore.processScheduledUpdates",
        "NeedStore.publishScheduledDirty",
        "NeedUrgencyIndex.[NEED_URGENCY_MARK_DIRTY]",
      ]),
    );
    expect(result.violations).toStrictEqual([]);
  });

  it("limits scheduled Need result allocation to direct public ABI object returns", () => {
    expect(auditSyntheticScheduledNeedRoot("return { ok: true };").violations).toStrictEqual([]);
    for (const body of [
      "return [];",
      "const result = { ok: true }; return result;",
      "const nested = (): unknown => ({ ok: true }); return { ok: true };",
    ]) {
      expect(auditSyntheticScheduledNeedRoot(body).violations.length).toBeGreaterThan(0);
    }
    const transitive = auditSyntheticScheduledNeedRoot(
      "urgency.publish(); return { ok: true };",
      "return { allocated: true };",
    );
    expect(transitive.reached).toContain("NeedUrgencyIndex.publish");
    expect(transitive.violations).toContain("NeedUrgencyIndex.publish: literal allocation");

    const nested = auditSyntheticScheduledNeedRoot("return { nested: { allocated: true } };");
    expect(nested.violations).toContain("NeedStore.processScheduledUpdates: literal allocation");
    const callback = auditSyntheticScheduledNeedRoot(
      "const invoke = function(): unknown { return { allocated: true }; }; return { ok: true };",
    );
    expect(callback.violations).toContain("NeedStore.processScheduledUpdates: closure allocation");

    const sameName = auditSyntheticScheduledNeedSource(`namespace Foreign {
      export class NeedStore {
        processScheduledUpdates(): unknown { return { allocated: true }; }
      }
    }
    class NeedStore {
      processScheduledUpdates(foreign: Foreign.NeedStore): unknown {
        foreign.processScheduledUpdates();
        return { ok: true };
      }
    }`);
    let sameNameDeclarations = 0;
    for (const declaration of sameName.reachedDeclarations) {
      if (declarationLabel(declaration) === "NeedStore.processScheduledUpdates") {
        sameNameDeclarations += 1;
      }
    }
    expect(sameNameDeclarations).toBe(2);
    expect(sameName.callCounts.get("NeedStore.processScheduledUpdates")).toBe(1);
    expect(sameName.violations).toContain("NeedStore.processScheduledUpdates: literal allocation");
  });

  it("exports Need read, prepare, snapshot, restore, and hash without commit authority", () => {
    const program = createProgram();
    const checker = program.getTypeChecker();
    const index = program
      .getSourceFiles()
      .find((source) => normalize(source.fileName).endsWith("/packages/sim-core/src/index.ts"));
    if (index === undefined) throw new Error("missing sim-core package root");
    const moduleSymbol = checker.getSymbolAtLocation(index);
    if (moduleSymbol === undefined) throw new Error("missing sim-core module symbol");
    const names: string[] = [];
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) names.push(symbol.name);
    for (const name of [
      "M3_NEED_STORE_SNAPSHOT_VERSION",
      "NeedLaneIntoOutput",
      "NeedLaneMutationPrepareInput",
      "PreparedNeedLaneMutation",
      "NeedStoreSnapshot",
      "NeedStoreRestoreResult",
      "createNeedStoreHashFields",
      "restoreNeedStore",
    ]) {
      expect(names).toContain(name);
    }
    expect(names).not.toContain("commitPreparedChangedNeedLaneMutation");
    expect(names).not.toContain("commitPreparedNoopNeedLaneMutation");
  });
});

function auditProjectRoot(
  rootLabel: string,
  includeAccessors = false,
  rejectDynamicAccessors = false,
): AuditResult {
  const program = createProgram();
  const checker = program.getTypeChecker();
  const root = findProjectMethod(program, rootLabel);
  const approvals = resolveInternalCommitApprovals(program, checker, INTERNAL_COMMIT_APPROVALS);
  return auditClosure(checker, root, approvals, includeAccessors, rejectDynamicAccessors);
}

function auditProjectFunction(functionName: string): AuditResult {
  const program = createProgram();
  const checker = program.getTypeChecker();
  const root = findProjectFunction(program, functionName);
  const approvals = resolveInternalCommitApprovals(program, checker, INTERNAL_COMMIT_APPROVALS);
  return auditClosure(checker, root, approvals);
}

function auditClosure(
  checker: ts.TypeChecker,
  root: ts.SignatureDeclaration,
  approvals: readonly InternalCommitApproval[],
  includeAccessors = false,
  rejectDynamicAccessors = false,
): AuditResult {
  const queue: ts.SignatureDeclaration[] = [root];
  const visited = new Set<ts.SignatureDeclaration>();
  const reached = new Set<string>();
  const reachedDeclarations = new Set<ts.SignatureDeclaration>();
  const violations: string[] = [];
  const callCounts = new Map<string, number>();
  const receiverOwners = new Set<string>();
  const receiverMethods = new Set<string>();
  for (const declaration of queue) {
    if (visited.has(declaration)) continue;
    visited.add(declaration);
    const label = declarationLabel(declaration);
    reached.add(label);
    reachedDeclarations.add(declaration);
    if (
      ts.canHaveModifiers(declaration) &&
      ts
        .getModifiers(declaration)
        ?.some((modifier: ts.Modifier): boolean => modifier.kind === ts.SyntaxKind.AsyncKeyword) ===
        true
    )
      violations.push(`${label}: async declaration`);
    const declarationOwner = declaration.parent;
    if (ts.isClassDeclaration(declarationOwner) && declarationOwner.name !== undefined) {
      receiverOwners.add(declarationOwner.name.text);
      receiverMethods.add(label);
    }
    const body = declarationBody(declaration);
    if (body === undefined) continue;
    scanBody(body, checker, declaration, root, label, violations);
    visitCalls(body, (call) => {
      const target = checker.getResolvedSignature(call)?.getDeclaration();
      if (target === undefined) {
        violations.push(`${label}: unresolved ${call.expression.getText()}`);
        return;
      }
      const targetLabel = declarationLabel(target);
      callCounts.set(targetLabel, (callCounts.get(targetLabel) ?? 0) + 1);
      if (!normalize(target.getSourceFile().fileName).includes(PROJECT_MARKER)) return;
      const receiverViolation = exactReceiverViolation(call, target, checker, approvals);
      if (receiverViolation !== undefined) {
        violations.push(`${label}: ${receiverViolation}`);
        return;
      }
      queue.push(target);
    });
    if (includeAccessors) {
      visitPropertyAccesses(body, (access) => {
        const symbol = checker.getSymbolAtLocation(access.name);
        if (symbol === undefined) {
          violations.push(`${label}: unresolved accessor ${access.getText()}`);
          return;
        }
        const target = symbol.declarations?.find(ts.isGetAccessorDeclaration);
        if (target === undefined) return;
        const targetLabel = declarationLabel(target);
        callCounts.set(targetLabel, (callCounts.get(targetLabel) ?? 0) + 1);
        if (!normalize(target.getSourceFile().fileName).includes(PROJECT_MARKER)) return;
        const receiverViolation = exactAccessorReceiverViolation(access, target, checker);
        if (receiverViolation !== undefined) {
          violations.push(`${label}: ${receiverViolation}`);
          return;
        }
        queue.push(target);
      });
      if (rejectDynamicAccessors)
        visitElementAccesses(body, (access) => {
          const target = resolveElementAccessor(access, checker);
          if (target === "dynamic") {
            if (
              ts.isCallExpression(access.parent) &&
              access.parent.expression === access &&
              isApprovedInternalCall(access.parent, checker, approvals)
            )
              return;
            violations.push(`${label}: dynamic accessor ${access.getText()}`);
            return;
          }
          if (target === undefined) return;
          const receiverViolation = exactAccessorReceiverViolation(access, target, checker);
          if (receiverViolation !== undefined) violations.push(`${label}: ${receiverViolation}`);
          else queue.push(target);
        });
    }
  }
  return {
    reached,
    reachedDeclarations,
    violations,
    callCounts,
    receiverOwners,
    receiverMethods,
  };
}

function isApprovedInternalCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  approvals: readonly InternalCommitApproval[],
): boolean {
  const target = checker.getResolvedSignature(call)?.getDeclaration();
  return (
    target !== undefined && exactReceiverViolation(call, target, checker, approvals) === undefined
  );
}

function auditSyntheticAccessorRoot(source: string): AuditResult {
  const fileName = `${process.cwd()}/packages/sim-core/src/owner-accessor-synthetic.ts`;
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    requested,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ): ts.SourceFile | undefined =>
    normalize(requested) === normalize(fileName)
      ? ts.createSourceFile(requested, source, languageVersion, true)
      : originalGetSourceFile(requested, languageVersion, onError, shouldCreateNewSourceFile);
  host.readFile = (requested): string | undefined =>
    normalize(requested) === normalize(fileName) ? source : ts.sys.readFile(requested);
  const program = ts.createProgram({ rootNames: [fileName], options, host });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  const root = sourceFile?.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "root",
  );
  if (root === undefined) throw new Error("missing synthetic accessor root");
  return auditClosure(checker, root, [], true, true);
}

function auditSyntheticScheduledNeedRoot(methodBody: string, helperBody = ""): AuditResult {
  const source = `class NeedUrgencyIndex {
    publish(): unknown { ${helperBody} }
  }
  class NeedStore {
    processScheduledUpdates(urgency: NeedUrgencyIndex): unknown { ${methodBody} }
  }`;
  return auditSyntheticScheduledNeedSource(source);
}

function auditSyntheticScheduledNeedSource(source: string): AuditResult {
  const fileName = `${process.cwd()}/packages/sim-core/src/need-schedule-closure-synthetic.ts`;
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    requested,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ): ts.SourceFile | undefined =>
    normalize(requested) === normalize(fileName)
      ? ts.createSourceFile(requested, source, languageVersion, true)
      : originalGetSourceFile(requested, languageVersion, onError, shouldCreateNewSourceFile);
  host.readFile = (requested): string | undefined =>
    normalize(requested) === normalize(fileName) ? source : ts.sys.readFile(requested);
  const program = ts.createProgram({ rootNames: [fileName], options, host });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  const owner = sourceFile?.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === "NeedStore",
  );
  const root = owner?.members.find(
    (member): member is ts.MethodDeclaration =>
      ts.isMethodDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === "processScheduledUpdates",
  );
  if (root === undefined) throw new Error("missing synthetic scheduled Need root");
  return auditClosure(checker, root, []);
}

function exactAccessorReceiverViolation(
  access: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  target: ts.GetAccessorDeclaration,
  checker: ts.TypeChecker,
): string | undefined {
  const owner = target.parent;
  if (!ts.isClassDeclaration(owner)) return `unreviewed accessor ${access.getText()}`;
  if (access.expression.kind === ts.SyntaxKind.ThisKeyword)
    return nearestClass(access) === owner ? undefined : `foreign this accessor ${access.getText()}`;
  return hasStableReceiver(access.expression, owner, checker)
    ? undefined
    : `foreign project accessor ${access.getText()}`;
}

function resolveElementAccessor(
  access: ts.ElementAccessExpression,
  checker: ts.TypeChecker,
): ts.GetAccessorDeclaration | "dynamic" | undefined {
  const argument = access.argumentExpression;
  const receiverType = checker.getTypeAtLocation(access.expression);
  if (ts.isStringLiteral(argument) || ts.isNumericLiteral(argument)) {
    const symbol = receiverType.getProperty(argument.text);
    return symbol?.declarations?.find(ts.isGetAccessorDeclaration);
  }
  for (const property of receiverType.getProperties())
    if (property.declarations?.some(ts.isGetAccessorDeclaration) === true) return "dynamic";
  return undefined;
}

const cachedProjectProgram = createProjectProgram();

function createProgram(): ts.Program {
  return cachedProjectProgram;
}

function createProjectProgram(): ts.Program {
  const configPath = ts.findConfigFile(
    process.cwd(),
    (fileName): boolean => ts.sys.fileExists(fileName),
    "tsconfig.typecheck.json",
  );
  if (configPath === undefined) throw new Error("missing tsconfig.typecheck.json");
  const loaded = ts.readConfigFile(configPath, (fileName): string | undefined =>
    ts.sys.readFile(fileName),
  );
  if (loaded.error !== undefined)
    throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, process.cwd());
  if (parsed.errors.length > 0) throw new Error("invalid typecheck config");
  return ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
}

function findProjectMethod(program: ts.Program, label: string): ts.MethodDeclaration {
  const separator = label.indexOf(".");
  const className = label.slice(0, separator);
  const methodName = label.slice(separator + 1);
  for (const source of program.getSourceFiles()) {
    if (!normalize(source.fileName).includes(PROJECT_MARKER)) continue;
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement) || statement.name?.text !== className) continue;
      for (const member of statement.members) {
        if (
          ts.isMethodDeclaration(member) &&
          ts.isIdentifier(member.name) &&
          member.name.text === methodName
        )
          return member;
      }
    }
  }
  throw new Error(`missing closure root ${label}`);
}

function findProjectFunction(program: ts.Program, functionName: string): ts.FunctionDeclaration {
  for (const source of program.getSourceFiles()) {
    if (!normalize(source.fileName).includes(PROJECT_MARKER)) continue;
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === functionName) {
        return statement;
      }
    }
  }
  throw new Error(`missing closure function ${functionName}`);
}

function exactReceiverViolation(
  call: ts.CallExpression,
  target: ts.SignatureDeclaration,
  checker: ts.TypeChecker,
  approvals: readonly InternalCommitApproval[],
): string | undefined {
  const owner = target.parent;
  if (owner === target.getSourceFile()) {
    return ts.isIdentifier(call.expression)
      ? undefined
      : `foreign free receiver ${call.expression.getText()}`;
  }
  if (ts.isClassDeclaration(owner) && ts.isElementAccessExpression(call.expression)) {
    const key = call.expression.argumentExpression;
    if (!ts.isIdentifier(key)) {
      return `dynamic internal receiver ${call.expression.getText()}`;
    }
    const keySymbol = checker.getSymbolAtLocation(key);
    const approved = approvals.find((entry) => entry.key === keySymbol && entry.owner === owner);
    if (approved === undefined) return `foreign internal key ${call.expression.getText()}`;
    return hasExactParameterReceiver(call.expression.expression, owner, checker)
      ? undefined
      : `foreign internal receiver ${call.expression.getText()}`;
  }
  if (!ts.isClassDeclaration(owner) || !ts.isPropertyAccessExpression(call.expression)) {
    return `unreviewed receiver ${call.expression.getText()}`;
  }
  const receiver = call.expression.expression;
  if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
    const callerClass = nearestClass(call);
    return callerClass === owner ? undefined : `foreign this receiver ${call.expression.getText()}`;
  }
  if (hasStableReceiver(receiver, owner, checker)) return undefined;
  return `foreign project receiver ${call.expression.getText()}`;
}

function hasExactParameterReceiver(
  receiver: ts.Expression,
  owner: ts.ClassDeclaration,
  checker: ts.TypeChecker,
): boolean {
  if (!ts.isIdentifier(receiver)) return false;
  const symbol = checker.getSymbolAtLocation(receiver);
  const declaration = symbol?.valueDeclaration;
  return (
    declaration !== undefined &&
    ts.isParameter(declaration) &&
    checker.getTypeAtLocation(declaration).getSymbol()?.declarations?.includes(owner) === true
  );
}

function hasStableReceiver(
  receiver: ts.Expression,
  owner: ts.ClassDeclaration,
  checker: ts.TypeChecker,
): boolean {
  if (
    !ts.isIdentifier(receiver) &&
    !(
      ts.isPropertyAccessExpression(receiver) &&
      receiver.expression.kind === ts.SyntaxKind.ThisKeyword
    )
  )
    return false;
  return checker.getTypeAtLocation(receiver).getSymbol()?.declarations?.includes(owner) === true;
}

function resolveInternalCommitApprovals(
  program: ts.Program,
  checker: ts.TypeChecker,
  names: readonly (readonly [string, string])[],
): readonly InternalCommitApproval[] {
  const approvals: InternalCommitApproval[] = [];
  for (const [keyName, ownerName] of names) {
    let key: ts.Symbol | undefined;
    let owner: ts.ClassDeclaration | undefined;
    for (const source of program.getSourceFiles()) {
      if (!normalize(source.fileName).includes(PROJECT_MARKER)) continue;
      for (const statement of source.statements) {
        if (ts.isClassDeclaration(statement) && statement.name?.text === ownerName)
          owner = statement;
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === keyName) {
            key = checker.getSymbolAtLocation(declaration.name);
          }
        }
      }
    }
    if (key === undefined || owner === undefined) throw new Error(`missing approval ${keyName}`);
    approvals.push({ key, owner });
  }
  return approvals;
}

function auditSyntheticRoot(body: string): AuditResult {
  const source = `const APPROVED = Symbol("commit");
    class Owner { [APPROVED](): void {} }
    ${body}
    function root(owner: Owner): void { invoke(owner); }`;
  const fileName = `${process.cwd()}/packages/sim-core/src/owner-closure-synthetic.ts`;
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    requested,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ): ts.SourceFile | undefined =>
    normalize(requested) === normalize(fileName)
      ? ts.createSourceFile(requested, source, languageVersion, true)
      : originalGetSourceFile(requested, languageVersion, onError, shouldCreateNewSourceFile);
  host.readFile = (requested): string | undefined =>
    normalize(requested) === normalize(fileName) ? source : ts.sys.readFile(requested);
  const program = ts.createProgram({ rootNames: [fileName], options, host });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  if (sourceFile === undefined) throw new Error("missing synthetic closure source");
  const root = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "root",
  );
  if (root === undefined) throw new Error("missing synthetic closure root");
  const approvals = resolveInternalCommitApprovals(program, checker, [["APPROVED", "Owner"]]);
  return auditClosure(checker, root, approvals);
}

function nearestClass(node: ts.Node): ts.ClassDeclaration | undefined {
  let current = node.parent;
  while (!ts.isSourceFile(current)) {
    if (ts.isClassDeclaration(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function scanBody(
  body: ts.ConciseBody,
  checker: ts.TypeChecker,
  declaration: ts.SignatureDeclaration,
  originalRoot: ts.SignatureDeclaration,
  label: string,
  violations: string[],
): void {
  function visit(node: ts.Node): void {
    const reason = forbiddenNode(node, checker, declaration, originalRoot);
    if (reason !== undefined) violations.push(`${label}: ${reason}`);
    else ts.forEachChild(node, visit);
  }
  ts.forEachChild(body, visit);
}

function forbiddenNode(
  node: ts.Node,
  checker: ts.TypeChecker,
  declaration: ts.SignatureDeclaration,
  originalRoot: ts.SignatureDeclaration,
): string | undefined {
  if (ts.isAwaitExpression(node)) return "await expression";
  if (ts.isNewExpression(node)) return "new expression";
  if (ts.isObjectLiteralExpression(node))
    return isDirectScheduledNeedResult(node, declaration, originalRoot)
      ? undefined
      : "literal allocation";
  if (ts.isArrayLiteralExpression(node)) return "literal allocation";
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return "closure allocation";
  if (ts.isForOfStatement(node)) return "for-of";
  if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return "unbounded loop";
  if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) return "spread";
  if (ts.isTemplateExpression(node)) return "template allocation";
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    FORBIDDEN_CALLS.has(node.expression.name.text)
  )
    return "materializing call";
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = checker.getTypeAtLocation(node.left).flags;
    const right = checker.getTypeAtLocation(node.right).flags;
    if ((left & ts.TypeFlags.StringLike) !== 0 || (right & ts.TypeFlags.StringLike) !== 0) {
      return "string concatenation";
    }
  }
  return undefined;
}

function isDirectScheduledNeedResult(
  node: ts.ObjectLiteralExpression,
  declaration: ts.SignatureDeclaration,
  originalRoot: ts.SignatureDeclaration,
): boolean {
  if (declaration !== originalRoot || !ts.isMethodDeclaration(originalRoot)) return false;
  const owner = originalRoot.parent;
  if (
    !ts.isClassDeclaration(owner) ||
    owner.name?.text !== "NeedStore" ||
    !ts.isIdentifier(originalRoot.name) ||
    originalRoot.name.text !== "processScheduledUpdates"
  )
    return false;
  const statement = node.parent;
  return (
    ts.isReturnStatement(statement) &&
    statement.expression === node &&
    nearestFunctionLike(statement) === originalRoot
  );
}

function nearestFunctionLike(node: ts.Node): ts.SignatureDeclaration | undefined {
  let current = node.parent;
  while (!ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function visitCalls(node: ts.Node, visit: (call: ts.CallExpression) => void): void {
  function descend(current: ts.Node): void {
    if (ts.isCallExpression(current)) visit(current);
    ts.forEachChild(current, descend);
  }
  ts.forEachChild(node, descend);
}

function visitPropertyAccesses(
  node: ts.Node,
  visit: (access: ts.PropertyAccessExpression) => void,
): void {
  function descend(current: ts.Node): void {
    if (ts.isPropertyAccessExpression(current)) visit(current);
    ts.forEachChild(current, descend);
  }
  ts.forEachChild(node, descend);
}

function visitElementAccesses(
  node: ts.Node,
  visit: (access: ts.ElementAccessExpression) => void,
): void {
  function descend(current: ts.Node): void {
    if (ts.isElementAccessExpression(current)) visit(current);
    ts.forEachChild(current, descend);
  }
  ts.forEachChild(node, descend);
}

function declarationBody(declaration: ts.SignatureDeclaration): ts.ConciseBody | undefined {
  return "body" in declaration ? declaration.body : undefined;
}

function declarationLabel(declaration: ts.SignatureDeclaration): string {
  const name = declaration.name?.getText() ?? "anonymous";
  const owner = declaration.parent;
  return ts.isClassDeclaration(owner) ? `${owner.name?.text ?? "anonymous"}.${name}` : name;
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/");
}
