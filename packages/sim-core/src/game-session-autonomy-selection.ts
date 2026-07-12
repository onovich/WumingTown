import type { EntityRegistry } from "./entity-id";
import type { AutonomyReasonCode } from "./game-session-autonomy-reasons";
import type { ResidentAutonomyStore } from "./game-session-autonomy-store";
import type {
  AutonomyDecisionKind,
  AutonomyState,
  AutonomyStoreOutput,
  AutonomyTransitionInput,
  AutonomyVersionBasis,
  ResidentAutonomyReadOutput,
} from "./game-session-autonomy-types";
import type {
  M3AbilityCacheStore,
  M3AbilityQueryIntoOutput,
  M3HealthConditionStore,
} from "./m3-health";
import type { NeedLane, NeedStore } from "./m3-needs";
import type { MapGrid } from "./map-grid";
import type { GridPathfinder, PathSearchIntoOutput } from "./pathing";
import type {
  ReservationAcquireIntoOutput,
  ReservationAcquireIntoScratch,
  ReservationLedger,
  ReservationTransactionRequest,
} from "./reservation-ledger";
import type { Tick } from "./time";
import type {
  WorkOfferIndex,
  WorkOfferReadIntoOutput,
  WorkOfferSelectionIntoOutput,
  WorkOfferSelectionIntoScratch,
} from "./work-offers";

export const AUTONOMY_DEFAULT_DECISION_CADENCE_TICKS = 30;
export const AUTONOMY_DEFAULT_RETRY_BACKOFF_TICKS = 30;

/** Owner-derived schedule facts are built once per tick and reused for every resident call. */
export interface AutonomyScheduleFactsLane {
  readonly sourceTick: Tick;
  readonly residentGenerations: Uint32Array;
  readonly scheduleCodes: Uint8Array;
  readonly windowOpenFlags: Uint8Array;
  readonly allowedWorkTypeMasks: Uint32Array;
  readonly permissionIds: Uint32Array;
  readonly ownerVersions: Uint32Array;
}

/** JobCore remains authoritative; this lane is only its reusable numeric decision projection. */
export interface AutonomyJobFactsLane {
  readonly sourceTick: Tick;
  readonly residentGenerations: Uint32Array;
  readonly activeFlags: Uint8Array;
  readonly jobIds: Uint32Array;
  readonly jobVersions: Uint32Array;
  readonly interruptionPolicyCodes: Uint8Array;
  readonly safePointFlags: Uint8Array;
}

/** Mutable owner basis supplied by WM-0171 and sampled before and after exact pathing. */
export interface AutonomyPathBasisLane {
  mapVersion: number;
  navigationVersion: number;
  regionVersion: number;
  roomVersion: number;
  regionGraphVersion: number;
}

/** Caller-owned request object structurally accepted by GridPathfinder.findPathInto. */
export interface AutonomyPathRequest {
  requestSequence: number;
  issuedTick: Tick;
  startCellIndex: number;
  goalCellIndex: number;
  readonly basis: AutonomyPathBasisLane;
  maxNodeExpansions: number;
}

/** Caller-owned query object structurally accepted by WorkOfferIndex.selectTopOffersInto. */
export interface AutonomyWorkOfferSelectionOptions {
  pawnId: number;
  workType: number;
  regionId: number;
  defId: number;
  urgencyBucket: number;
  permissionId: number;
  candidateCap: number;
  maxSelectedOffers: number;
}

export interface AutonomyClaimPlanIntoOutput {
  ok: boolean;
  reasonCode: AutonomyReasonCode;
  offerId: number;
  targetId: number;
  targetCellIndex: number;
  claimCount: number;
  readonly transaction: ReservationTransactionRequest;
}

/** Direct indexed lookup only; implementations must reset and fill the supplied output in place. */
export interface AutonomyClaimPlanSource {
  readPlanInto(
    offerId: number,
    targetId: number,
    targetCellIndex: number,
    output: AutonomyClaimPlanIntoOutput,
  ): void;
}

export interface AutonomyDecisionRequest {
  readonly tick: Tick;
  readonly residentIndex: number;
  readonly residentGeneration: number;
  readonly originCellIndex: number;
  readonly originRegionId: number;
  readonly needLane: NeedLane;
  readonly emergencyNeedThreshold: number;
  readonly workType: number;
  readonly defId: number;
  readonly urgencyBucket: number;
  readonly ability: number;
  readonly minimumAbilityValue: number;
  readonly requestSequenceStart: number;
  readonly maxNodeExpansions: number;
}

export interface AutonomyDecisionScratch {
  readonly residentReadOutput: ResidentAutonomyReadOutput;
  readonly offerOptions: AutonomyWorkOfferSelectionOptions;
  readonly offerScratch: WorkOfferSelectionIntoScratch;
  readonly offerOutput: WorkOfferSelectionIntoOutput;
  readonly offerReadOutput: WorkOfferReadIntoOutput;
  readonly pathRequest: AutonomyPathRequest;
  readonly pathOutput: PathSearchIntoOutput;
  readonly pathRouteCells: Uint32Array;
  readonly selectedRouteCells: Uint32Array;
  readonly abilityOutput: M3AbilityQueryIntoOutput;
  readonly selectedBasis: AutonomyVersionBasis;
  readonly claimPlanOutput: AutonomyClaimPlanIntoOutput;
  readonly reservationScratch: ReservationAcquireIntoScratch;
  readonly reservationOutput: ReservationAcquireIntoOutput;
  readonly reservationClaimIds: Uint32Array;
  readonly transitionInput: AutonomyTransitionInput;
  readonly transitionValidationOutput: AutonomyStoreOutput;
  readonly transitionOutput: AutonomyStoreOutput;
}

export interface AutonomyDecisionOutput {
  ok: boolean;
  decisionKind: AutonomyDecisionKind;
  state: AutonomyState;
  reasonCode: AutonomyReasonCode;
  residentIndex: number;
  residentGeneration: number;
  offerId: number;
  jobId: number;
  targetId: number;
  targetCellIndex: number;
  routeCellCount: number;
  claimCount: number;
  rowVersion: number;
  storeVersion: number;
  reservationVersion: number;
  visitedCount: number;
  scoredCount: number;
  selectedCount: number;
  exactPathCount: number;
  nodeExpansions: number;
}

export interface AutonomyDecisionMetricsOutput {
  tick: Tick;
  decisionsUsedThisTick: number;
  decisionStartCount: number;
  claimedCount: number;
  waitCount: number;
  keepWorkingCount: number;
  interruptionRequestCount: number;
  failedCount: number;
  deferredCount: number;
  visitedCount: number;
  scoredCount: number;
  selectedCount: number;
  candidateCapHitCount: number;
  retainedCapHitCount: number;
  exactPathCount: number;
  exactPathCapHitCount: number;
  nodeExpansionCount: number;
  staleNeedCount: number;
  staleScheduleCount: number;
  staleCapabilityCount: number;
  staleOfferCount: number;
  stalePathCount: number;
  staleJobCount: number;
  reservationConflictCount: number;
  decisionDeferralCount: number;
  lastReasonCode: AutonomyReasonCode;
}

export interface ResidentAutonomyCoordinatorOptions {
  readonly decisionCadenceTicks?: number;
  readonly retryBackoffTicks?: number;
}

export interface ResidentAutonomyCoordinatorDependencies {
  readonly autonomyStore: ResidentAutonomyStore;
  readonly needs: NeedStore;
  readonly scheduleFacts: AutonomyScheduleFactsLane;
  readonly jobFacts: AutonomyJobFactsLane;
  readonly workOffers: WorkOfferIndex;
  readonly map: MapGrid;
  readonly pathBasis: AutonomyPathBasisLane;
  readonly pathfinder: GridPathfinder;
  readonly abilities: M3AbilityCacheStore;
  readonly healthConditions: M3HealthConditionStore;
  readonly reservations: ReservationLedger;
  readonly entities: EntityRegistry;
  readonly claimPlans: AutonomyClaimPlanSource;
}
