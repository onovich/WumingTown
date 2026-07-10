import type {
  COMMAND_BLOCKED_REASON_CODE,
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
} from "./constants";
import type {
  GameSessionProjectionContractV1,
  GameSessionProjectionRequestV1,
  GameSessionRenderProjectionV1,
  GameSessionAlertV1,
  GameSessionUiProjectionV1,
} from "./game-session-projection";

export type MainToSimulationMessageKind =
  (typeof MAIN_TO_SIMULATION_MESSAGE_KIND)[keyof typeof MAIN_TO_SIMULATION_MESSAGE_KIND];
export type SimulationToMainMessageKind =
  (typeof SIMULATION_TO_MAIN_MESSAGE_KIND)[keyof typeof SIMULATION_TO_MAIN_MESSAGE_KIND];
export type SimulationProtocolReasonCode =
  (typeof SIMULATION_PROTOCOL_REASON_CODE)[keyof typeof SIMULATION_PROTOCOL_REASON_CODE];

export interface ProtocolRejection {
  readonly code: SimulationProtocolReasonCode;
  readonly detail: string;
}

export interface ProtocolEnvelope<K extends string, P> {
  readonly protocolVersion: number;
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly sequence: number;
  readonly kind: K;
  readonly payload: P;
}

export interface InitSessionPayload {
  readonly seed: string;
  readonly catalogVersion: string;
  readonly projectionRequest?: GameSessionProjectionRequestV1;
}

export interface LoadSessionPayload {
  readonly saveId: string;
  readonly checkpointSequence: number;
}

export type PlayerCommandKind = (typeof PLAYER_COMMAND_KIND)[keyof typeof PLAYER_COMMAND_KIND];
export type CommandBlockedReasonCode =
  (typeof COMMAND_BLOCKED_REASON_CODE)[keyof typeof COMMAND_BLOCKED_REASON_CODE];

export interface ProtocolEntityRef {
  readonly index: number;
  readonly generation: number;
}

export interface CellRef {
  readonly x: number;
  readonly y: number;
  readonly cellIndex: number;
}

export interface CommandBasis {
  readonly playableCommandContractVersion: 1;
  readonly basisTick: number;
  readonly basisSnapshotSequence: number;
  readonly basisReadModelHash: string;
  readonly contentManifestHash: string;
  readonly targetVersion?: number;
  readonly mapVersion?: number;
  readonly reservationVersion?: number;
  readonly jobVersion?: number;
}

export interface PrioritizeLampWorkPayload {
  readonly target:
    | { readonly kind: "lamp"; readonly entity: ProtocolEntityRef }
    | { readonly kind: "lamp_gap"; readonly gapId: string; readonly anchorCell: CellRef }
    | { readonly kind: "build_site"; readonly siteId: number; readonly site: ProtocolEntityRef };
  readonly requestedAction: "auto" | "refill_lamp" | "repair_lamp" | "complete_lamp_build_site";
  readonly priorityBand: 1 | 2 | 3;
}

export interface QueueSimpleBuildPayload {
  readonly blueprint:
    | { readonly kind: "simple_lamp_post"; readonly blueprintDefId: number }
    | { readonly kind: "simple_repair_frame"; readonly blueprintDefId: number };
  readonly anchorCell: CellRef;
  readonly orientation: 0 | 1 | 2 | 3;
  readonly priorityBand: 1 | 2 | 3;
}

export type PlayerCommandPayload = PrioritizeLampWorkPayload | QueueSimpleBuildPayload;

export type PlayerCommand =
  | LegacyPlayerCommand
  | PrioritizeLampWorkCommand
  | QueueSimpleBuildCommand;

export interface LegacyPlayerCommand {
  readonly commandId: string;
  readonly kind: typeof PLAYER_COMMAND_KIND.Noop | typeof PLAYER_COMMAND_KIND.Echo;
}

export interface PrioritizeLampWorkCommand {
  readonly commandId: string;
  readonly kind: typeof PLAYER_COMMAND_KIND.PrioritizeLampWork;
  readonly payload: PrioritizeLampWorkPayload;
  readonly basis: CommandBasis;
}

export interface QueueSimpleBuildCommand {
  readonly commandId: string;
  readonly kind: typeof PLAYER_COMMAND_KIND.QueueSimpleBuild;
  readonly payload: QueueSimpleBuildPayload;
  readonly basis: CommandBasis;
}

export interface PlayerCommandBatchPayload {
  readonly commands: readonly PlayerCommand[];
}

export interface SetSpeedPayload {
  readonly speed: 0 | 1 | 2 | 3;
}

export interface PausePayload {
  readonly paused: boolean;
}

export type UiDetailSubject =
  | {
      readonly kind: "session";
    }
  | {
      readonly kind: "entity";
      readonly entityId: string;
    };

export interface RequestUiDetailPayload {
  readonly subject: UiDetailSubject;
}

export interface RequestSavePayload {
  readonly reason: "manual" | "autosave";
}

export interface DevCommandPayload {
  readonly command: "echo";
  readonly text: string;
}

export interface ShutdownPayload {
  readonly reason: "client-request";
}

export type InitSessionMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
  InitSessionPayload
>;
export type LoadSessionMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
  LoadSessionPayload
>;
export type PlayerCommandBatchMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
  PlayerCommandBatchPayload
>;
export type SetSpeedMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed,
  SetSpeedPayload
>;
export type PauseMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.Pause,
  PausePayload
>;
export type RequestUiDetailMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
  RequestUiDetailPayload
>;
export type RequestSaveMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
  RequestSavePayload
>;
export type DevCommandMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand,
  DevCommandPayload
>;
export type ShutdownMessage = ProtocolEnvelope<
  typeof MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown,
  ShutdownPayload
>;

export type MainToSimulationMessage =
  | InitSessionMessage
  | LoadSessionMessage
  | PlayerCommandBatchMessage
  | SetSpeedMessage
  | PauseMessage
  | RequestUiDetailMessage
  | RequestSaveMessage
  | DevCommandMessage
  | ShutdownMessage;

export interface ReadyPayload {
  readonly acceptedProtocolVersion: number;
  readonly acceptedSchemaVersion: number;
  readonly status: "ready";
  readonly projectionContract?: GameSessionProjectionContractV1;
}

export interface RenderSnapshotPayload {
  readonly snapshotSequence: number;
  readonly tick: number;
  readonly entityCount: number;
  readonly scenarioId?: string;
  readonly worldHash?: string;
  readonly readModelHash?: string;
  readonly readOnly?: true;
  readonly gameSession?: GameSessionRenderProjectionV1;
}

export interface UiDeltaPayload {
  readonly tick: number;
  readonly summaries: readonly string[];
  readonly scenarioId?: string;
  readonly readModelHash?: string;
  readonly detailHash?: string;
  readonly readOnly?: true;
  readonly playable?: PlayableProjectionV1;
  readonly gameSession?: GameSessionUiProjectionV1;
}

export interface PlayableProjectionBasisV1 {
  readonly tick: number;
  readonly snapshotSequence: number;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly contentManifestHash: string;
  readonly targetVersion: number;
  readonly mapVersion: number;
  readonly reservationVersion: number;
  readonly jobVersion: number;
  readonly commandBasis: CommandBasis;
}

export interface PlayableCommandTemplateV1 {
  readonly commandKind:
    | typeof PLAYER_COMMAND_KIND.PrioritizeLampWork
    | typeof PLAYER_COMMAND_KIND.QueueSimpleBuild;
  readonly commandBasis: CommandBasis;
  readonly payload: PlayerCommandPayload;
  readonly available: boolean;
  readonly disabledReason?: CommandBlockedReason;
}

export interface PlayableTargetActionProjectionV1 {
  readonly target: CommandTargetRef;
  readonly targetState: "available" | "active" | "blocked" | "completed";
  readonly targetVersion: number;
  readonly actions: readonly PlayableCommandTemplateV1[];
  readonly blockedReason?: CommandBlockedReason;
}

export interface PlayablePlacementProjectionV1 {
  readonly blueprint: QueueSimpleBuildPayload["blueprint"];
  readonly anchorCell: CellRef;
  readonly orientation: 0 | 1 | 2 | 3;
  readonly orientationOptions: readonly [0, 1, 2, 3];
  readonly footprint: readonly CellRef[];
  readonly interactionCells: readonly CellRef[];
  readonly valid: boolean;
  readonly command: PlayableCommandTemplateV1;
  readonly blockedReason?: CommandBlockedReason;
}

export interface PlayableOrderJobProjectionV1 {
  readonly orderId: string;
  readonly commandId: string;
  readonly jobId: number;
  readonly jobKind: CommandJobRef["jobKind"];
  readonly markerState:
    | "queued"
    | "claimable"
    | "claimed"
    | "moving"
    | "working"
    | "blocked"
    | "completed"
    | "failed"
    | "canceled";
  readonly owner?: ProtocolEntityRef;
  readonly target: CommandTargetRef;
  readonly progressQ16: number;
  readonly requiredWork: number;
  readonly blockedReason?: CommandBlockedReason;
}

export interface PlayablePawnProjectionV1 {
  readonly actor: ProtocolEntityRef;
  readonly displayId: string;
  readonly cellIndex: number;
  readonly state: "idle" | "moving" | "working" | "blocked" | "completed" | "failed";
  readonly orderId: string;
  readonly jobId: number;
  readonly pathTargetCell: number;
  readonly blockedReason?: CommandBlockedReason;
}

export interface PlayableBuildProjectionV1 {
  readonly siteId: number;
  readonly site: ProtocolEntityRef;
  readonly active: boolean;
  readonly completed: boolean;
  readonly blueprintDefId: number;
  readonly anchorCell: CellRef;
  readonly interactionCells: readonly CellRef[];
  readonly requiredMaterials: readonly PlayableResourceRequirementProjectionV1[];
  readonly buildProgressTicks: number;
  readonly buildRequiredTicks: number;
  readonly lanternState: number;
}

export interface PlayableLampProjectionV1 {
  readonly target: CommandTargetRef;
  readonly state: "gap" | "queued" | "working" | "completed" | "blocked";
  readonly reason: "dusk_lamp_gap";
  readonly progressQ16: number;
  readonly requiredWork: number;
  readonly blockedReason?: CommandBlockedReason;
}

export interface PlayableResourceRequirementProjectionV1 {
  readonly defId: number;
  readonly requiredAmount: number;
  readonly deliveredAmount: number;
  readonly reservedAmount: number;
  readonly remainingAmount: number;
}

export interface PlayableResourceCountProjectionV1 {
  readonly defId: number;
  readonly availableAmount: number;
  readonly reservedAmount: number;
  readonly totalAmount: number;
}

export interface PlayableResourceProjectionV1 {
  readonly materials: readonly PlayableResourceCountProjectionV1[];
}

export interface PlayableProjectionV1 {
  readonly playableCommandReadModelVersion: 1;
  readonly basis: PlayableProjectionBasisV1;
  readonly targets: readonly PlayableTargetActionProjectionV1[];
  readonly placements: readonly PlayablePlacementProjectionV1[];
  readonly orders: readonly PlayableOrderJobProjectionV1[];
  readonly pawns: readonly PlayablePawnProjectionV1[];
  readonly build?: PlayableBuildProjectionV1;
  readonly lamps: readonly PlayableLampProjectionV1[];
  readonly resources: PlayableResourceProjectionV1;
  readonly alerts: readonly CommandBlockedReason[];
}

export type CommandResultPayload = CommandResultAcceptedPayload | CommandResultRejectedPayload;

export interface CommandResultAcceptedPayload {
  readonly inReplyToSequence: number;
  readonly accepted: true;
  readonly reason?: ProtocolRejection;
  readonly batchAccepted: true;
  readonly batchReason?: ProtocolRejection;
  readonly commandResults: readonly PlayerCommandResult[];
}

export interface CommandResultRejectedPayload {
  readonly inReplyToSequence: number;
  readonly accepted: false;
  readonly reason: ProtocolRejection;
  readonly batchAccepted: false;
  readonly batchReason: ProtocolRejection;
  readonly commandResults: readonly PlayerCommandResult[];
}

export type CommandTargetRef =
  | {
      readonly kind: "lamp";
      readonly entity: ProtocolEntityRef;
    }
  | {
      readonly kind: "lamp_gap";
      readonly gapId: string;
      readonly anchorCell: CellRef;
    }
  | {
      readonly kind: "build_site";
      readonly siteId: number;
      readonly site: ProtocolEntityRef;
    }
  | {
      readonly kind: "build_cell";
      readonly anchorCell: CellRef;
      readonly blueprintDefId: number;
    };

export interface ResourceRequirementRef {
  readonly defId: number;
  readonly requiredAmount: number;
  readonly availableAmount: number;
  readonly reservedAmount: number;
}

export interface StaleBasisRef {
  readonly expectedTick?: number;
  readonly observedTick?: number;
  readonly expectedReadModelHash?: string;
  readonly observedReadModelHash?: string;
  readonly expectedVersion?: number;
  readonly observedVersion?: number;
}

export interface PolicyRef {
  readonly policyId: string;
  readonly reasonCode: string;
}

export interface CandidateCounts {
  readonly workerCandidates: number;
  readonly visitedCandidates: number;
  readonly selectedCandidates: number;
  readonly candidateCap: number;
  readonly candidateCapHit: boolean;
  readonly pathRequests: number;
}

export interface CommandBlockedReason {
  readonly code: CommandBlockedReasonCode;
  readonly source:
    | "command_validation"
    | "work_selection"
    | "reservation"
    | "pathing"
    | "job_driver"
    | "policy";
  readonly target?: CommandTargetRef;
  readonly actor?: ProtocolEntityRef;
  readonly requirement?: ResourceRequirementRef;
  readonly basis?: StaleBasisRef;
  readonly policy?: PolicyRef;
  readonly candidateCounts?: CandidateCounts;
}

export interface CommandOrderRef {
  readonly orderKind: "lamp_priority" | "simple_build";
  readonly orderId: string;
  readonly targetVersion: number;
}

export interface CommandJobRef {
  readonly jobId: number;
  readonly jobKind:
    | "lamp_refill"
    | "lamp_repair"
    | "build_site_delivery"
    | "build_site_construction";
  readonly owner?: ProtocolEntityRef;
}

export type PlayerCommandResult = PlayerCommandAcceptedResult | PlayerCommandRejectedResult;

export interface PlayerCommandAcceptedResult {
  readonly commandId: string;
  readonly kind:
    | typeof PLAYER_COMMAND_KIND.PrioritizeLampWork
    | typeof PLAYER_COMMAND_KIND.QueueSimpleBuild;
  readonly status: "accepted";
  readonly acceptedTick: number;
  readonly committedTick: number;
  readonly target: CommandTargetRef;
  readonly order?: CommandOrderRef;
  readonly job?: CommandJobRef;
  readonly initialState: "queued" | "claimable" | "claimed" | "blocked" | "completed";
  readonly blockedReason?: CommandBlockedReason;
}

export interface PlayerCommandRejectedResult {
  readonly commandId: string;
  readonly kind:
    | typeof PLAYER_COMMAND_KIND.PrioritizeLampWork
    | typeof PLAYER_COMMAND_KIND.QueueSimpleBuild;
  readonly status: "rejected";
  readonly rejectedTick: number;
  readonly reason: CommandBlockedReason;
}

export interface AlertBatchPayload {
  readonly alerts: readonly ProtocolRejection[];
  readonly gameSession?: readonly GameSessionAlertV1[];
}

export interface SaveReadyPayload {
  readonly saveId: string;
  readonly sourceSequence: number;
  readonly scenarioId?: string;
  readonly checkpointTick?: number;
  readonly worldHash?: string;
}

export interface MetricsSamplePayload {
  readonly tick: number;
  readonly droppedSnapshots: number;
  readonly queuedReliableMessages: number;
  readonly scenarioId?: string;
  readonly worldHash?: string;
  readonly checkpointCount?: number;
}

export interface FatalSimulationErrorPayload {
  readonly reason: ProtocolRejection;
}

export type ReadyMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
  ReadyPayload
>;
export type RenderSnapshotMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
  RenderSnapshotPayload
>;
export type UiDeltaMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
  UiDeltaPayload
>;
export type CommandResultMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
  CommandResultPayload
>;
export type AlertBatchMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch,
  AlertBatchPayload
>;
export type SaveReadyMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
  SaveReadyPayload
>;
export type MetricsSampleMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
  MetricsSamplePayload
>;
export type FatalSimulationErrorMessage = ProtocolEnvelope<
  typeof SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
  FatalSimulationErrorPayload
>;

export type SimulationToMainMessage =
  | ReadyMessage
  | RenderSnapshotMessage
  | UiDeltaMessage
  | CommandResultMessage
  | AlertBatchMessage
  | SaveReadyMessage
  | MetricsSampleMessage
  | FatalSimulationErrorMessage;

export type MainMessageValidationResult =
  | {
      readonly ok: true;
      readonly message: MainToSimulationMessage;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
      readonly observedSessionId: string;
      readonly observedSequence: number;
    };
