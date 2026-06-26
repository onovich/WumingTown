import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import {
  HAULING_BUILDING_SCENARIO_ID,
  M2_WORK_LOGISTICS_SCENARIO_ID,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  createM4AdvanceCommandId,
  SIM_CORE_SMOKE,
  createM1AdvanceCommandId,
  createM1HaulingBuildingSaveEnvelope,
  createM1ReadOnlyProjection,
  createM2AdvanceCommandId,
  createM2ReadOnlyProjection,
  createM2WorkLogisticsSaveEnvelope,
  createM3AdvanceCommandId,
  createM3OrdinaryLifeSaveEnvelope,
  createM3ReadOnlyProjection,
  createM4CoreVerticalSliceSaveEnvelope,
  createM4ReadOnlyProjection,
  parseM1AdvanceCommandId,
  parseM2AdvanceCommandId,
  parseM3AdvanceCommandId,
  parseM4AdvanceCommandId,
  runM4CoreVerticalSliceScenario,
  runM3OrdinaryLifeScenario,
  runM2WorkLogisticsScenario,
  runHaulingBuildingScenario,
  type M1ReadOnlyProjection,
  type M2ReadOnlyProjection,
  type M3ReadOnlyProjection,
  type M4ReadOnlyProjection,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  SIM_PROTOCOL_SMOKE,
  validateMainToSimulationMessage,
  type CommandResultMessage,
  type MainToSimulationMessage,
  type ProtocolRejection,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export const SIM_WORKER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-worker",
  "package",
);

export const SIM_WORKER_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  SIM_PROTOCOL_SMOKE.packageName,
];

export interface SimulationWorker {
  receive(input: unknown): readonly SimulationToMainMessage[];
}

export interface SimulationWorkerMessageEvent {
  readonly data: unknown;
}

export interface SimulationWorkerPort {
  postMessage(message: SimulationToMainMessage): void;
  addEventListener(type: "message", listener: (event: SimulationWorkerMessageEvent) => void): void;
  removeEventListener?(
    type: "message",
    listener: (event: SimulationWorkerMessageEvent) => void,
  ): void;
}

export interface SimulationWorkerConnection {
  disconnect(): void;
}

type WorkerLifecycle = "idle" | "ready" | "shutdown";

interface SimulationWorkerState {
  lifecycle: WorkerLifecycle;
  sessionId: string;
  lastMainSequence: number;
  nextWorkerSequence: number;
  tick: number;
  droppedSnapshots: number;
  queuedReliableMessages: number;
  speed: 0 | 1 | 2 | 3;
  paused: boolean;
  m1Scenario: M1WorkerScenarioState | undefined;
  m2Scenario: M2WorkerScenarioState | undefined;
  m3Scenario: M3WorkerScenarioState | undefined;
  m4Scenario: M4WorkerScenarioState | undefined;
}

interface M1WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M2WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M3WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

interface M4WorkerScenarioState {
  readonly seed: string;
  checkpointCount: number;
}

export function createSimulationWorker(): SimulationWorker {
  const state: SimulationWorkerState = {
    lifecycle: "idle",
    sessionId: "",
    lastMainSequence: 0,
    nextWorkerSequence: 1,
    tick: 0,
    droppedSnapshots: 0,
    queuedReliableMessages: 0,
    speed: 1,
    paused: false,
    m1Scenario: undefined,
    m2Scenario: undefined,
    m3Scenario: undefined,
    m4Scenario: undefined,
  };

  return {
    receive(input: unknown): readonly SimulationToMainMessage[] {
      const validation = validateMainToSimulationMessage(input);

      if (!validation.ok) {
        return [
          makeRejectedCommandResult(
            state,
            validation.observedSessionId,
            validation.observedSequence,
            validation.reason,
          ),
        ];
      }

      const message = validation.message;
      const guard = guardLifecycleAndOrdering(state, message);

      if (guard !== undefined) {
        return [rejectValidMessage(state, message, guard)];
      }

      state.lastMainSequence = message.sequence;
      return handleAcceptedMessage(state, message);
    },
  };
}

export function connectSimulationWorkerPort(
  port: SimulationWorkerPort,
  worker: SimulationWorker = createSimulationWorker(),
): SimulationWorkerConnection {
  const listener = (event: SimulationWorkerMessageEvent): void => {
    const responses = worker.receive(event.data);

    for (const response of responses) {
      port.postMessage(response);
    }
  };

  port.addEventListener("message", listener);

  return {
    disconnect(): void {
      port.removeEventListener?.("message", listener);
    },
  };
}

function guardLifecycleAndOrdering(
  state: SimulationWorkerState,
  message: MainToSimulationMessage,
): ProtocolRejection | undefined {
  if (state.lifecycle !== "idle" && message.sessionId !== state.sessionId) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.StaleSession,
      detail: "message sessionId does not match the active simulation session",
    };
  }

  if (message.sequence <= state.lastMainSequence) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.StaleSequence,
      detail: "message sequence has already been processed by this Worker",
    };
  }

  if (state.lifecycle === "shutdown") {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: "simulation session is already shut down",
    };
  }

  if (state.lifecycle === "idle" && !isSessionStartMessage(message)) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: "simulation session must be initialized or loaded before commands are accepted",
    };
  }

  if (state.lifecycle === "ready" && isSessionStartMessage(message)) {
    return {
      code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
      detail: "simulation session is already active",
    };
  }

  return undefined;
}

function handleAcceptedMessage(
  state: SimulationWorkerState,
  message: MainToSimulationMessage,
): readonly SimulationToMainMessage[] {
  switch (message.kind) {
    case MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession:
      state.lifecycle = "ready";
      state.sessionId = message.sessionId;
      state.tick = 0;
      state.m1Scenario =
        message.payload.catalogVersion === HAULING_BUILDING_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m2Scenario =
        message.payload.catalogVersion === M2_WORK_LOGISTICS_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m3Scenario =
        message.payload.catalogVersion === M3_ORDINARY_LIFE_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      state.m4Scenario =
        message.payload.catalogVersion === M4_CORE_VERTICAL_SLICE_SCENARIO_ID
          ? { seed: message.payload.seed, checkpointCount: 1 }
          : undefined;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession:
      state.lifecycle = "ready";
      state.sessionId = message.sessionId;
      state.tick = message.payload.checkpointSequence;
      state.m1Scenario = undefined;
      state.m2Scenario = undefined;
      state.m3Scenario = undefined;
      state.m4Scenario = undefined;
      return [
        makeReady(state),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch:
      if (state.m1Scenario !== undefined) {
        applyM1Commands(state, message.payload.commands);
      } else if (state.m2Scenario !== undefined) {
        applyM2Commands(state, message.payload.commands);
      } else if (state.m3Scenario !== undefined) {
        applyM3Commands(state, message.payload.commands);
      } else if (state.m4Scenario !== undefined) {
        applyM4Commands(state, message.payload.commands);
      } else {
        state.tick += message.payload.commands.length;
      }
      return [
        makeAcceptedCommandResult(state, message.sequence),
        makeRenderSnapshot(state, message.sequence),
        makeUiDelta(state),
        makeMetricsSample(state),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed:
      state.speed = message.payload.speed;
      return [makeAcceptedCommandResult(state, message.sequence), makeMetricsSample(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Pause:
      state.paused = message.payload.paused;
      return [makeAcceptedCommandResult(state, message.sequence), makeMetricsSample(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail:
      return [makeAcceptedCommandResult(state, message.sequence), makeUiDelta(state)];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave:
      return [
        makeAcceptedCommandResult(state, message.sequence),
        makeSaveReady(state, message.sequence),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.DevCommand:
      return [
        makeAcceptedCommandResult(state, message.sequence),
        makeAlertBatch(state, {
          code: SIMULATION_PROTOCOL_REASON_CODE.LifecycleError,
          detail: `dev echo: ${message.payload.text}`,
        }),
      ];

    case MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown:
      state.lifecycle = "shutdown";
      return [makeAcceptedCommandResult(state, message.sequence)];
  }
}

function rejectValidMessage(
  state: SimulationWorkerState,
  message: MainToSimulationMessage,
  reason: ProtocolRejection,
): CommandResultMessage {
  state.lastMainSequence = Math.max(state.lastMainSequence, message.sequence);
  return makeRejectedCommandResult(state, message.sessionId, message.sequence, reason);
}

function makeReady(state: SimulationWorkerState): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
    payload: {
      acceptedProtocolVersion: SIM_PROTOCOL_VERSION,
      acceptedSchemaVersion: SIM_SCHEMA_VERSION,
      status: "ready",
    },
  };
}

function makeRenderSnapshot(
  state: SimulationWorkerState,
  sourceSequence: number,
): SimulationToMainMessage {
  const projection = readWorkerProjection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
      payload: {
        snapshotSequence: sourceSequence,
        tick: state.tick,
        entityCount: projection.entityCount,
        scenarioId: projection.scenarioId,
        worldHash: projection.worldHash,
        readModelHash: projection.readModelHash,
        readOnly: true,
      },
    };
  }

  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
    payload: {
      snapshotSequence: sourceSequence,
      tick: state.tick,
      entityCount: 0,
    },
  };
}

function makeUiDelta(state: SimulationWorkerState): SimulationToMainMessage {
  const projection = readWorkerProjection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      payload: {
        tick: state.tick,
        summaries: projection.summaries,
        scenarioId: projection.scenarioId,
        readModelHash: projection.readModelHash,
        detailHash: projection.detailHash,
        readOnly: true,
      },
    };
  }

  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
    payload: {
      tick: state.tick,
      summaries: [
        `lifecycle=${state.lifecycle}; speed=${String(state.speed)}; paused=${String(state.paused)}`,
      ],
    },
  };
}

function makeAcceptedCommandResult(
  state: SimulationWorkerState,
  inReplyToSequence: number,
): CommandResultMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
    payload: {
      inReplyToSequence,
      accepted: true,
    },
  };
}

function makeRejectedCommandResult(
  state: SimulationWorkerState,
  observedSessionId: string,
  inReplyToSequence: number,
  reason: ProtocolRejection,
): CommandResultMessage {
  return {
    ...nextEnvelopeBase(state, observedSessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
    payload: {
      inReplyToSequence,
      accepted: false,
      reason,
    },
  };
}

function makeAlertBatch(
  state: SimulationWorkerState,
  reason: ProtocolRejection,
): SimulationToMainMessage {
  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch,
    payload: {
      alerts: [reason],
    },
  };
}

function makeSaveReady(
  state: SimulationWorkerState,
  sourceSequence: number,
): SimulationToMainMessage {
  const saved = createFocusedSave(state);
  const saveEnvelope = readFocusedSaveEnvelope(saved);

  if (saveEnvelope !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
      payload: {
        saveId: `${state.sessionId}:${String(sourceSequence)}`,
        sourceSequence,
        scenarioId: saveEnvelope.scenarioId,
        checkpointTick: saveEnvelope.createdTick,
        worldHash: saveEnvelope.worldHash,
      },
    };
  }

  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady,
    payload: {
      saveId: `${state.sessionId}:${String(sourceSequence)}`,
      sourceSequence,
    },
  };
}

function makeMetricsSample(state: SimulationWorkerState): SimulationToMainMessage {
  const projection = readWorkerProjection(state);

  if (projection !== undefined) {
    return {
      ...nextEnvelopeBase(state, state.sessionId),
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
      payload: {
        tick: state.tick,
        droppedSnapshots: state.droppedSnapshots,
        queuedReliableMessages: state.queuedReliableMessages,
        scenarioId: projection.scenarioId,
        worldHash: projection.worldHash,
        checkpointCount: projection.checkpointCount,
      },
    };
  }

  return {
    ...nextEnvelopeBase(state, state.sessionId),
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
    payload: {
      tick: state.tick,
      droppedSnapshots: state.droppedSnapshots,
      queuedReliableMessages: state.queuedReliableMessages,
    },
  };
}

function applyM1Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const tick = parseM1AdvanceCommandId(command.commandId);
    if (tick !== undefined && tick >= state.tick) {
      state.tick = tick;
      if (state.m1Scenario !== undefined) {
        state.m1Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyM2Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const tick = parseM2AdvanceCommandId(command.commandId);
    if (tick !== undefined && tick >= state.tick) {
      state.tick = tick;
      if (state.m2Scenario !== undefined) {
        state.m2Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyM3Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const tick = parseM3AdvanceCommandId(command.commandId);
    if (tick !== undefined && tick >= state.tick) {
      state.tick = tick;
      if (state.m3Scenario !== undefined) {
        state.m3Scenario.checkpointCount += 1;
      }
    }
  }
}

function applyM4Commands(
  state: SimulationWorkerState,
  commands: readonly { readonly commandId: string }[],
): void {
  for (const command of commands) {
    const parsed = parseM4AdvanceCommandId(command.commandId);
    if (parsed.ok && parsed.tick >= state.tick) {
      state.tick = parsed.tick;
      if (state.m4Scenario !== undefined) {
        state.m4Scenario.checkpointCount += 1;
      }
    }
  }
}

interface WorkerProjectionView {
  readonly scenarioId: string;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly entityCount: number;
  readonly summaries: readonly string[];
  readonly detailHash: string;
  readonly checkpointCount: number;
}

function readWorkerProjection(state: SimulationWorkerState): WorkerProjectionView | undefined {
  const m1Projection = readM1Projection(state);
  if (m1Projection !== undefined) {
    return {
      scenarioId: m1Projection.scenarioId,
      worldHash: m1Projection.worldHash,
      readModelHash: m1Projection.readModelHash,
      entityCount: m1Projection.renderSnapshot.entityCount,
      summaries: m1Projection.uiDetail.summaries,
      detailHash: m1Projection.uiDetail.detailHash,
      checkpointCount: state.m1Scenario?.checkpointCount ?? 0,
    };
  }

  const m2Projection = readM2Projection(state);
  if (m2Projection !== undefined) {
    return {
      scenarioId: m2Projection.scenarioId,
      worldHash: m2Projection.worldHash,
      readModelHash: m2Projection.readModelHash,
      entityCount: m2Projection.renderSnapshot.actorCount,
      summaries: m2Projection.orderReadModel.summaries,
      detailHash: m2Projection.orderReadModel.detailHash,
      checkpointCount: state.m2Scenario?.checkpointCount ?? 0,
    };
  }

  const m3Projection = readM3Projection(state);
  if (m3Projection !== undefined) {
    return {
      scenarioId: m3Projection.scenarioId,
      worldHash: m3Projection.worldHash,
      readModelHash: m3Projection.readModelHash,
      entityCount: m3Projection.renderSnapshot.actorCount,
      summaries: m3Projection.scenarioReadModel.summaries,
      detailHash: m3Projection.scenarioReadModel.detailHash,
      checkpointCount: state.m3Scenario?.checkpointCount ?? 0,
    };
  }

  const m4Projection = readM4Projection(state);
  if (m4Projection === undefined) {
    return undefined;
  }

  return {
    scenarioId: m4Projection.scenarioId,
    worldHash: m4Projection.worldHash,
    readModelHash: m4Projection.readModelHash,
    entityCount: m4Projection.renderSnapshot.branchCount,
    summaries: createM4WorkerSummaries(m4Projection),
    detailHash: m4Projection.scenarioReadModel.detailHash,
    checkpointCount: state.m4Scenario?.checkpointCount ?? 0,
  };
}

function readM1Projection(state: SimulationWorkerState): M1ReadOnlyProjection | undefined {
  const scenario = state.m1Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runHaulingBuildingScenario({ seed: scenario.seed, ticks: state.tick });
  return createM1ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM2Projection(state: SimulationWorkerState): M2ReadOnlyProjection | undefined {
  const scenario = state.m2Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runM2WorkLogisticsScenario({ seed: scenario.seed, ticks: state.tick });
  return createM2ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM3Projection(state: SimulationWorkerState): M3ReadOnlyProjection | undefined {
  const scenario = state.m3Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runM3OrdinaryLifeScenario({ seed: scenario.seed, ticks: state.tick });
  return createM3ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function readM4Projection(state: SimulationWorkerState): M4ReadOnlyProjection | undefined {
  const scenario = state.m4Scenario;
  if (scenario === undefined) {
    return undefined;
  }

  const summary = runM4CoreVerticalSliceScenario({ seed: scenario.seed, ticks: state.tick });
  return createM4ReadOnlyProjection(summary, scenario.checkpointCount - 1);
}

function createM4WorkerSummaries(projection: M4ReadOnlyProjection): readonly string[] {
  const summaries: string[] = [];

  for (const summary of projection.scenarioReadModel.summaries) {
    summaries.push(summary);
  }

  for (const surface of projection.rebuiltIndexes.surfaces) {
    summaries.push(
      `m4-basis:${surface.name}=${surface.hash};version=${String(surface.sourceVersion)}`,
    );
  }

  summaries.push(`m4-basis:projection=${projection.readModelHash};tick=${String(projection.tick)}`);
  return summaries;
}

function createFocusedSave(
  state: SimulationWorkerState,
):
  | ReturnType<typeof createM1HaulingBuildingSaveEnvelope>
  | ReturnType<typeof createM2WorkLogisticsSaveEnvelope>
  | ReturnType<typeof createM3OrdinaryLifeSaveEnvelope>
  | ReturnType<typeof createM4CoreVerticalSliceSaveEnvelope>
  | undefined {
  if (state.m1Scenario !== undefined) {
    return createM1HaulingBuildingSaveEnvelope(state.m1Scenario.seed, state.tick);
  }

  if (state.m2Scenario !== undefined) {
    return createM2WorkLogisticsSaveEnvelope(state.m2Scenario.seed, state.tick);
  }

  if (state.m3Scenario !== undefined) {
    return createM3OrdinaryLifeSaveEnvelope(state.m3Scenario.seed, state.tick);
  }

  if (state.m4Scenario !== undefined) {
    return createM4CoreVerticalSliceSaveEnvelope(state.m4Scenario.seed, state.tick);
  }

  return undefined;
}

interface FocusedSaveEnvelopeView {
  readonly scenarioId: string;
  readonly createdTick: number;
  readonly worldHash: string;
}

function readFocusedSaveEnvelope(input: unknown): FocusedSaveEnvelopeView | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const wrapped = input["ok"] === true ? input["save"] : input;
  if (!isRecord(wrapped)) {
    return undefined;
  }

  const sections = wrapped["sections"];
  if (!isRecord(sections)) {
    return undefined;
  }

  const commandLogTail = sections["commandLogTail"];
  if (!isRecord(commandLogTail)) {
    return undefined;
  }

  const scenarioId = wrapped["scenarioId"];
  const createdTick = wrapped["createdTick"];
  const worldHash = commandLogTail["checkpointWorldHash"];
  if (
    typeof scenarioId !== "string" ||
    typeof createdTick !== "number" ||
    typeof worldHash !== "string"
  ) {
    return undefined;
  }

  return {
    scenarioId,
    createdTick,
    worldHash,
  };
}

export function createM1WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (const tick of checkpointTicks) {
    commandIds.push(createM1AdvanceCommandId(tick));
  }

  return commandIds;
}

export function createM2WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (const tick of checkpointTicks) {
    commandIds.push(createM2AdvanceCommandId(tick));
  }

  return commandIds;
}

export function createM3WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (const tick of checkpointTicks) {
    commandIds.push(createM3AdvanceCommandId(tick));
  }

  return commandIds;
}

export function createM4WorkerAdvanceCommandIds(
  checkpointTicks: readonly number[],
): readonly string[] {
  const commandIds: string[] = [];

  for (let index = 0; index < checkpointTicks.length; index += 1) {
    const tick = checkpointTicks[index];
    if (tick !== undefined) {
      commandIds.push(createM4AdvanceCommandId(tick, index));
    }
  }

  return commandIds;
}

interface OutgoingEnvelopeBase {
  readonly protocolVersion: typeof SIM_PROTOCOL_VERSION;
  readonly schemaVersion: typeof SIM_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly sequence: number;
}

function nextEnvelopeBase(
  state: SimulationWorkerState,
  observedSessionId: string,
): OutgoingEnvelopeBase {
  const sessionId = observedSessionId.length > 0 ? observedSessionId : "invalid-session";
  const sequence = state.nextWorkerSequence;
  state.nextWorkerSequence += 1;

  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId,
    sequence,
  };
}

function isSessionStartMessage(message: MainToSimulationMessage): boolean {
  return (
    message.kind === MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession ||
    message.kind === MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
