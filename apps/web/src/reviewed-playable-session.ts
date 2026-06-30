import type {
  EntityTaskReadModel,
  StructuredReasonReadModel,
  TileCoordinate,
  WorldEntityActivityReadModel,
  WorldEntityReadModel,
  WorldJobMarkerReadModel,
  WorldReadModel,
  WorldStructuredJobKind,
} from "@wuming-town/sim-protocol";

import { WEB_PRODUCT_GATE_READ_MODEL } from "./product-gate-fixture";

export type ReviewedPlayableActionId = "prioritize-lamp-work" | "queue-simple-build";

export interface ReviewedPlayableActionState {
  readonly actionId: ReviewedPlayableActionId;
  readonly adapterId: "wm0151-reviewed-projection-harness";
  readonly authority: "world-read-model-projection";
  readonly commandId: string;
  readonly markerState?: WorldJobMarkerReadModel["state"];
  readonly orderId?: string;
  readonly progressPercent?: number;
  readonly reasonCode?: string;
  readonly reasonDetail?: string;
  readonly reasonSource?: string;
  readonly status: "accepted" | "rejected";
  readonly targetEntityId: string;
  readonly targetLabel: string;
}

export interface ReviewedPlayableSnapshot {
  readonly currentTick: number;
  readonly latestCommand?: ReviewedPlayableActionState;
  readonly readModel: WorldReadModel;
}

export interface ReviewedPlayableProjectionSession {
  destroy(): void;
  queuePrioritizeLampWork(targetEntityId: string): ReviewedPlayableActionState;
  queueSimpleBuild(targetEntityId: string): ReviewedPlayableActionState;
  readSnapshot(selectedEntityId?: string): ReviewedPlayableSnapshot;
  subscribe(listener: () => void): () => void;
}

export interface ProjectedPlayableDebugState {
  readonly currentTick: number;
  readonly latestCommand?: {
    readonly actionId: ReviewedPlayableActionState["actionId"];
    readonly commandId: string;
    readonly markerState?: WorldJobMarkerReadModel["state"];
    readonly progressPercent?: number;
    readonly reasonCode?: string;
    readonly status: ReviewedPlayableActionState["status"];
  };
  readonly jobMarkers: readonly {
    readonly commandId: string;
    readonly markerId: string;
    readonly ownerEntityId?: string;
    readonly progressPercent?: number;
    readonly state: WorldJobMarkerReadModel["state"];
  }[];
  readonly pawns: readonly {
    readonly entityId: string;
    readonly progressPercent?: number;
    readonly state: NonNullable<WorldEntityReadModel["activity"]>["state"];
    readonly tile: TileCoordinate;
  }[];
}

interface ScenarioDefinition {
  readonly actionId: ReviewedPlayableActionId;
  readonly commandPrefix: string;
  readonly defaultTargetId: string;
  readonly jobKind: WorldStructuredJobKind;
  readonly ownerEntityId: string;
  readonly steps: readonly ScenarioStep[];
}

interface ScenarioStep {
  readonly activityState: NonNullable<WorldEntityReadModel["activity"]>["state"];
  readonly detail: string;
  readonly durationTicks: number;
  readonly markerState: WorldJobMarkerReadModel["state"];
  readonly pathTiles?: readonly TileCoordinate[];
  readonly pawnTile: TileCoordinate;
  readonly progressPercent?: number;
  readonly reason?: StructuredReasonReadModel;
  readonly stepLabel: string;
}

interface ActiveScenario {
  readonly commandId: string;
  readonly definition: ScenarioDefinition;
  readonly markerId: string;
  readonly orderId: string;
  stepIndex: number;
  ticksRemaining: number;
}

const ACTION_ADAPTER_ID = "wm0151-reviewed-projection-harness";
const ACTION_AUTHORITY = "world-read-model-projection";
const TARGET_ENTITY_ID = "east-market-lantern-post";
const TARGET_LABEL = "East Market Lantern Post";
const TARGET_TILE = createTile(120, 92);
const LAMP_OWNER_ENTITY_ID = "lantern-keeper-shen";
const BUILD_OWNER_ENTITY_ID = "lamp-aide-15";
const LAMP_START_TILE = createTile(72, 102);
const BUILD_START_TILE = createTile(88, 118);
const TICK_INTERVAL_MS = 140;
const DEFAULT_TICKS = 1;
const WM0151_ALLOWED_TARGET_IDS = new Set<string>([
  BUILD_OWNER_ENTITY_ID,
  LAMP_OWNER_ENTITY_ID,
  TARGET_ENTITY_ID,
]);

export const WM0151_DEFAULT_SELECTED_ENTITY_ID = LAMP_OWNER_ENTITY_ID;

const LAMP_PATH = Object.freeze([
  LAMP_START_TILE,
  createTile(80, 102),
  createTile(88, 100),
  createTile(96, 98),
  createTile(104, 96),
  createTile(112, 94),
  TARGET_TILE,
]);

const BUILD_PATH = Object.freeze([
  BUILD_START_TILE,
  createTile(94, 114),
  createTile(100, 108),
  createTile(108, 102),
  createTile(114, 96),
  TARGET_TILE,
]);
const LAMP_PATH_STEP_2 = LAMP_PATH[2] ?? TARGET_TILE;
const LAMP_PATH_STEP_4 = LAMP_PATH[4] ?? TARGET_TILE;
const BUILD_PATH_STEP_2 = BUILD_PATH[2] ?? TARGET_TILE;
const BUILD_PATH_STEP_3 = BUILD_PATH[3] ?? TARGET_TILE;
const BUILD_PATH_STEP_4 = BUILD_PATH[4] ?? TARGET_TILE;

const BUILD_BLOCKED_REASON: StructuredReasonReadModel = Object.freeze({
  code: "no_path",
  detail: "Timber handoff stalled at the east stockpile route until the lane cleared.",
  source: "reviewed_projection",
});

const BASE_REVIEWED_PLAYABLE_READ_MODEL = createBaseReadModel();

const LAMP_SCENARIO: ScenarioDefinition = {
  actionId: "prioritize-lamp-work",
  commandPrefix: "wm0151-lamp",
  defaultTargetId: TARGET_ENTITY_ID,
  jobKind: "lamp_refill",
  ownerEntityId: LAMP_OWNER_ENTITY_ID,
  steps: [
    {
      activityState: "idle",
      detail: "Lamp refill marker is visible and waiting for the next worker.",
      durationTicks: 2,
      markerState: "queued",
      pawnTile: LAMP_START_TILE,
      stepLabel: "Visible on the map and waiting for a worker",
    },
    {
      activityState: "moving",
      detail: "Lantern Keeper Shen claimed the lamp refill route.",
      durationTicks: 2,
      markerState: "claimed",
      pathTiles: createPathSlice(LAMP_PATH, 0),
      pawnTile: LAMP_START_TILE,
      stepLabel: "Claimed by a pawn and lining up the route",
    },
    {
      activityState: "moving",
      detail: "Lantern Keeper Shen is following the reviewed lamp route.",
      durationTicks: 3,
      markerState: "moving",
      pathTiles: createPathSlice(LAMP_PATH, 2),
      pawnTile: LAMP_PATH_STEP_2,
      stepLabel: "Walking the reviewed route",
    },
    {
      activityState: "moving",
      detail: "Lantern Keeper Shen is still advancing along the intent line.",
      durationTicks: 3,
      markerState: "moving",
      pathTiles: createPathSlice(LAMP_PATH, 4),
      pawnTile: LAMP_PATH_STEP_4,
      stepLabel: "Walking the reviewed route",
    },
    {
      activityState: "working",
      detail: "Lamp oil is being applied at the east market post.",
      durationTicks: 3,
      markerState: "working",
      pawnTile: TARGET_TILE,
      progressPercent: 28,
      stepLabel: "Refilling the lamp at the target",
    },
    {
      activityState: "working",
      detail: "Lamp oil work is visibly progressing at the target.",
      durationTicks: 3,
      markerState: "working",
      pawnTile: TARGET_TILE,
      progressPercent: 74,
      stepLabel: "Refilling the lamp at the target",
    },
    {
      activityState: "completed",
      detail: "The east market lamp is stable again and the route is complete.",
      durationTicks: 4,
      markerState: "completed",
      pawnTile: TARGET_TILE,
      progressPercent: 100,
      stepLabel: "Resolved and handed back to idle",
    },
  ],
};

const BUILD_SCENARIO: ScenarioDefinition = {
  actionId: "queue-simple-build",
  commandPrefix: "wm0151-build",
  defaultTargetId: TARGET_ENTITY_ID,
  jobKind: "build_site_construction",
  ownerEntityId: BUILD_OWNER_ENTITY_ID,
  steps: [
    {
      activityState: "idle",
      detail: "Build marker is visible at the lamp frame and waiting for claim.",
      durationTicks: 2,
      markerState: "queued",
      pawnTile: BUILD_START_TILE,
      stepLabel: "Visible on the map and waiting for a worker",
    },
    {
      activityState: "moving",
      detail: "Lamp Aide 15 accepted the reviewed build order.",
      durationTicks: 2,
      markerState: "claimed",
      pathTiles: createPathSlice(BUILD_PATH, 0),
      pawnTile: BUILD_START_TILE,
      stepLabel: "Claimed by a pawn and lining up the route",
    },
    {
      activityState: "moving",
      detail: "Lamp Aide 15 is carrying materials down the reviewed path.",
      durationTicks: 3,
      markerState: "moving",
      pathTiles: createPathSlice(BUILD_PATH, 2),
      pawnTile: BUILD_PATH_STEP_2,
      stepLabel: "Walking the reviewed route",
    },
    {
      activityState: "blocked",
      detail: BUILD_BLOCKED_REASON.detail,
      durationTicks: 3,
      markerState: "blocked",
      pawnTile: BUILD_PATH_STEP_3,
      reason: BUILD_BLOCKED_REASON,
      stepLabel: "Stopped with a structured reason",
    },
    {
      activityState: "moving",
      detail: "The stockpile lane reopened and the worker resumed the build route.",
      durationTicks: 2,
      markerState: "moving",
      pathTiles: createPathSlice(BUILD_PATH, 4),
      pawnTile: BUILD_PATH_STEP_4,
      stepLabel: "Walking the reviewed route",
    },
    {
      activityState: "working",
      detail: "The lamp post frame is going up at the target.",
      durationTicks: 3,
      markerState: "working",
      pawnTile: TARGET_TILE,
      progressPercent: 24,
      stepLabel: "Raising the lamp post frame",
    },
    {
      activityState: "working",
      detail: "Construction progress is visible at the east market target.",
      durationTicks: 3,
      markerState: "working",
      pawnTile: TARGET_TILE,
      progressPercent: 67,
      stepLabel: "Raising the lamp post frame",
    },
    {
      activityState: "completed",
      detail: "The lamp post frame is complete and handed back to town idle.",
      durationTicks: 4,
      markerState: "completed",
      pawnTile: TARGET_TILE,
      progressPercent: 100,
      stepLabel: "Resolved and handed back to idle",
    },
  ],
};

export function createReviewedPlayableProjectionSession(): ReviewedPlayableProjectionSession {
  const listeners = new Set<() => void>();
  const scenarios: ActiveScenario[] = [];
  let buildSequence = 0;
  let currentTick = 0;
  let intervalId: number | undefined;
  let lampSequence = 0;
  let latestCommandId: string | undefined;

  function startTimer(): void {
    if (intervalId !== undefined) {
      return;
    }

    intervalId = window.setInterval(() => {
      if (scenarios.length === 0) {
        stopTimer();
        return;
      }

      currentTick += 1;
      let changed = false;
      for (const scenario of scenarios) {
        if (advanceScenario(scenario)) {
          changed = true;
        }
      }

      if (changed) {
        emit();
      }

      if (!hasPendingScenarioProgress(scenarios)) {
        stopTimer();
      }
    }, TICK_INTERVAL_MS);
  }

  function stopTimer(): void {
    if (intervalId === undefined) {
      return;
    }

    window.clearInterval(intervalId);
    intervalId = undefined;
  }

  function queuePrioritizeLampWork(targetEntityId: string): ReviewedPlayableActionState {
    lampSequence += 1;
    return queueScenario(LAMP_SCENARIO, targetEntityId, lampSequence);
  }

  function queueSimpleBuild(targetEntityId: string): ReviewedPlayableActionState {
    buildSequence += 1;
    return queueScenario(BUILD_SCENARIO, targetEntityId, buildSequence);
  }

  function queueScenario(
    definition: ScenarioDefinition,
    requestedTargetId: string,
    sequence: number,
  ): ReviewedPlayableActionState {
    if (!WM0151_ALLOWED_TARGET_IDS.has(requestedTargetId)) {
      return {
        actionId: definition.actionId,
        adapterId: ACTION_ADAPTER_ID,
        authority: ACTION_AUTHORITY,
        commandId: `${definition.commandPrefix}-${padSequence(sequence)}`,
        reasonCode: "invalid_target",
        reasonDetail: `Target ${requestedTargetId} is not part of the reviewed WM-0151 projection slice.`,
        reasonSource: "reviewed_projection",
        status: "rejected",
        targetEntityId: TARGET_ENTITY_ID,
        targetLabel: TARGET_LABEL,
      };
    }

    removeExistingScenario(definition.actionId);
    const commandId = `${definition.commandPrefix}-${padSequence(sequence)}`;
    const orderId = `${commandId}-order`;
    const scenario: ActiveScenario = {
      commandId,
      definition,
      markerId: `${orderId}-marker`,
      orderId,
      stepIndex: 0,
      ticksRemaining: definition.steps[0]?.durationTicks ?? DEFAULT_TICKS,
    };
    scenarios.push(scenario);
    latestCommandId = commandId;
    startTimer();
    emit();
    return readActionState(scenario);
  }

  function removeExistingScenario(actionId: ReviewedPlayableActionId): void {
    for (let index = scenarios.length - 1; index >= 0; index -= 1) {
      const scenario = scenarios[index];
      if (scenario?.definition.actionId === actionId) {
        scenarios.splice(index, 1);
      }
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return (): void => {
      listeners.delete(listener);
    };
  }

  function destroy(): void {
    stopTimer();
    listeners.clear();
  }

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function readSnapshot(selectedEntityId?: string): ReviewedPlayableSnapshot {
    const readModel = buildReadModel(scenarios, latestCommandId, selectedEntityId);
    const latestScenario =
      latestCommandId === undefined
        ? undefined
        : findScenarioByCommandId(scenarios, latestCommandId);
    return {
      currentTick,
      ...(latestScenario === undefined ? {} : { latestCommand: readActionState(latestScenario) }),
      readModel,
    };
  }

  return {
    destroy,
    queuePrioritizeLampWork,
    queueSimpleBuild,
    readSnapshot,
    subscribe,
  };
}

function hasPendingScenarioProgress(scenarios: readonly ActiveScenario[]): boolean {
  for (const scenario of scenarios) {
    if (scenario.ticksRemaining > 1) {
      return true;
    }

    if (scenario.definition.steps[scenario.stepIndex + 1] !== undefined) {
      return true;
    }
  }

  return false;
}

export function createProjectedPlayableDebugState(
  snapshot: ReviewedPlayableSnapshot,
): ProjectedPlayableDebugState {
  const lampPawn = readRequiredEntity(snapshot.readModel, LAMP_OWNER_ENTITY_ID);
  const buildPawn = readRequiredEntity(snapshot.readModel, BUILD_OWNER_ENTITY_ID);
  return {
    currentTick: snapshot.currentTick,
    ...(snapshot.latestCommand === undefined
      ? {}
      : {
          latestCommand: {
            actionId: snapshot.latestCommand.actionId,
            commandId: snapshot.latestCommand.commandId,
            ...(snapshot.latestCommand.markerState === undefined
              ? {}
              : { markerState: snapshot.latestCommand.markerState }),
            ...(snapshot.latestCommand.progressPercent === undefined
              ? {}
              : { progressPercent: snapshot.latestCommand.progressPercent }),
            ...(snapshot.latestCommand.reasonCode === undefined
              ? {}
              : { reasonCode: snapshot.latestCommand.reasonCode }),
            status: snapshot.latestCommand.status,
          },
        }),
    jobMarkers: (snapshot.readModel.jobMarkers ?? []).map((marker) => ({
      commandId: marker.commandId,
      markerId: marker.markerId,
      ...(marker.ownerEntityId === undefined ? {} : { ownerEntityId: marker.ownerEntityId }),
      ...(marker.progressPercent === undefined ? {} : { progressPercent: marker.progressPercent }),
      state: marker.state,
    })),
    pawns: [createDebugPawn(lampPawn), createDebugPawn(buildPawn)],
  };
}

function createDebugPawn(
  entity: WorldEntityReadModel,
): ProjectedPlayableDebugState["pawns"][number] {
  return {
    entityId: entity.entityId,
    ...(entity.activity?.progressPercent === undefined
      ? {}
      : { progressPercent: entity.activity.progressPercent }),
    state: entity.activity?.state ?? "idle",
    tile: entity.tile,
  };
}

function advanceScenario(scenario: ActiveScenario): boolean {
  if (scenario.ticksRemaining > 1) {
    scenario.ticksRemaining -= 1;
    return false;
  }

  const nextStepIndex = scenario.stepIndex + 1;
  const nextStep = scenario.definition.steps[nextStepIndex];
  if (nextStep === undefined) {
    return false;
  }

  scenario.stepIndex = nextStepIndex;
  scenario.ticksRemaining = nextStep.durationTicks;
  return true;
}

function buildReadModel(
  scenarios: readonly ActiveScenario[],
  latestCommandId: string | undefined,
  selectedEntityId: string | undefined,
): WorldReadModel {
  const jobMarkers = buildJobMarkers(scenarios);
  const targetMarker = pickTargetMarker(jobMarkers, latestCommandId);
  const entities = BASE_REVIEWED_PLAYABLE_READ_MODEL.entities.map((entity) => {
    if (entity.entityId === LAMP_OWNER_ENTITY_ID) {
      return buildPawnEntity(entity, findScenarioByOwnerEntityId(scenarios, LAMP_OWNER_ENTITY_ID));
    }

    if (entity.entityId === BUILD_OWNER_ENTITY_ID) {
      return buildPawnEntity(entity, findScenarioByOwnerEntityId(scenarios, BUILD_OWNER_ENTITY_ID));
    }

    if (entity.entityId === TARGET_ENTITY_ID) {
      return buildTargetEntity(entity, targetMarker);
    }

    return entity;
  });

  return {
    ...BASE_REVIEWED_PLAYABLE_READ_MODEL,
    entities,
    jobMarkers,
    selectedEntityId: selectedEntityId ?? WM0151_DEFAULT_SELECTED_ENTITY_ID,
  };
}

function buildPawnEntity(
  baseEntity: WorldEntityReadModel,
  scenario: ActiveScenario | undefined,
): WorldEntityReadModel {
  if (scenario === undefined) {
    return createIdlePawnEntity(baseEntity);
  }

  const step = readScenarioStep(scenario);
  const task = createTaskModel(scenario, step);
  return {
    ...baseEntity,
    inspector: {
      ...baseEntity.inspector,
      currentJob: formatJobKind(scenario.definition.jobKind),
      currentStep: task.stepLabel,
      lastDecision: step.detail,
      task,
    },
    summary: step.detail,
    tile: step.pawnTile,
    activity: createPawnActivity(step),
  };
}

function createIdlePawnEntity(baseEntity: WorldEntityReadModel): WorldEntityReadModel {
  const idleTask = createIdleTask(
    baseEntity.entityId === BUILD_OWNER_ENTITY_ID ? "build_site_construction" : "lamp_refill",
  );
  return {
    ...baseEntity,
    inspector: {
      ...baseEntity.inspector,
      currentJob: formatJobKind(idleTask.jobKind),
      currentStep: idleTask.stepLabel,
      task: idleTask,
    },
    activity: {
      detail: "Waiting for the next reviewed order.",
      intentLabel: TARGET_LABEL,
      label: "Idle",
      state: "idle",
      targetEntityId: TARGET_ENTITY_ID,
      targetTile: TARGET_TILE,
    },
  };
}

function createIdleTask(jobKind: WorldStructuredJobKind): EntityTaskReadModel {
  return {
    jobKind,
    state: "idle",
    stepLabel: "Waiting for the next reviewed order",
    targetLabel: TARGET_LABEL,
    targetTile: TARGET_TILE,
  };
}

function createTaskModel(scenario: ActiveScenario, step: ScenarioStep): EntityTaskReadModel {
  return {
    commandId: scenario.commandId,
    jobKind: scenario.definition.jobKind,
    orderId: scenario.orderId,
    ...(step.progressPercent === undefined ? {} : { progressPercent: step.progressPercent }),
    ...(step.reason === undefined ? {} : { reason: step.reason }),
    state: step.markerState,
    stepLabel: step.stepLabel,
    targetLabel: TARGET_LABEL,
    targetTile: TARGET_TILE,
  };
}

function createPawnActivity(step: ScenarioStep): WorldEntityActivityReadModel {
  return {
    detail: step.detail,
    intentLabel: TARGET_LABEL,
    label: formatActivityLabel(step),
    ...(step.pathTiles === undefined ? {} : { pathTiles: step.pathTiles }),
    ...(step.progressPercent === undefined ? {} : { progressPercent: step.progressPercent }),
    state: step.activityState,
    targetEntityId: TARGET_ENTITY_ID,
    targetTile: TARGET_TILE,
  };
}

function formatActivityLabel(step: ScenarioStep): string {
  if (step.activityState === "completed") {
    return "Completed";
  }
  if (step.activityState === "blocked") {
    return "Blocked";
  }
  if (step.activityState === "working") {
    return "Working";
  }
  if (step.markerState === "claimed") {
    return "Claimed";
  }
  if (step.activityState === "moving") {
    return "Moving";
  }
  return "Idle";
}

function buildJobMarkers(scenarios: readonly ActiveScenario[]): readonly WorldJobMarkerReadModel[] {
  return scenarios.map((scenario) => {
    const step = readScenarioStep(scenario);
    return {
      commandId: scenario.commandId,
      detail: step.detail,
      jobKind: scenario.definition.jobKind,
      label: formatJobKind(scenario.definition.jobKind),
      markerId: scenario.markerId,
      orderId: scenario.orderId,
      ...(step.markerState === "queued" || step.markerState === "claimable"
        ? {}
        : { ownerEntityId: scenario.definition.ownerEntityId }),
      ...(step.progressPercent === undefined ? {} : { progressPercent: step.progressPercent }),
      ...(step.reason === undefined ? {} : { reason: step.reason }),
      state: step.markerState,
      targetEntityId: TARGET_ENTITY_ID,
      tile: TARGET_TILE,
    };
  });
}

function pickTargetMarker(
  markers: readonly WorldJobMarkerReadModel[],
  latestCommandId: string | undefined,
): WorldJobMarkerReadModel | undefined {
  if (latestCommandId !== undefined) {
    for (const marker of markers) {
      if (marker.commandId === latestCommandId) {
        return marker;
      }
    }
  }

  for (const marker of markers) {
    if (marker.state !== "completed") {
      return marker;
    }
  }

  return markers[0];
}

function buildTargetEntity(
  baseEntity: WorldEntityReadModel,
  marker: WorldJobMarkerReadModel | undefined,
): WorldEntityReadModel {
  const task =
    marker === undefined
      ? createIdleTask("lamp_refill")
      : {
          commandId: marker.commandId,
          jobKind: marker.jobKind,
          orderId: marker.orderId,
          ...(marker.progressPercent === undefined
            ? {}
            : { progressPercent: marker.progressPercent }),
          ...(marker.reason === undefined ? {} : { reason: marker.reason }),
          state: marker.state,
          stepLabel: formatTargetStep(marker.state, marker.jobKind),
          targetLabel: TARGET_LABEL,
          targetTile: TARGET_TILE,
        };
  return {
    ...baseEntity,
    inspector: {
      ...baseEntity.inspector,
      currentJob: formatJobKind(task.jobKind),
      currentStep: task.stepLabel,
      lastDecision:
        marker?.reason === undefined
          ? "Mirror the reviewed projection on the town map."
          : marker.reason.detail,
      task,
    },
    summary:
      marker === undefined
        ? "Reviewed work target waiting for the next worker-visible order."
        : marker.detail,
  };
}

function formatTargetStep(
  state: WorldJobMarkerReadModel["state"],
  jobKind: WorldStructuredJobKind,
): string {
  if (state === "working") {
    return jobKind === "build_site_construction"
      ? "Raising the lamp post frame"
      : "Refilling the lamp at the target";
  }
  if (state === "blocked") {
    return "Stopped with a structured reason";
  }
  if (state === "completed") {
    return "Resolved and handed back to idle";
  }
  if (state === "moving") {
    return "Worker moving to target";
  }
  if (state === "claimed") {
    return "Claimed by a worker";
  }
  return "Visible on the map and waiting for a worker";
}

function findScenarioByCommandId(
  scenarios: readonly ActiveScenario[],
  commandId: string,
): ActiveScenario | undefined {
  for (const scenario of scenarios) {
    if (scenario.commandId === commandId) {
      return scenario;
    }
  }

  return undefined;
}

function findScenarioByOwnerEntityId(
  scenarios: readonly ActiveScenario[],
  entityId: string,
): ActiveScenario | undefined {
  for (const scenario of scenarios) {
    if (scenario.definition.ownerEntityId === entityId) {
      return scenario;
    }
  }

  return undefined;
}

function readActionState(scenario: ActiveScenario): ReviewedPlayableActionState {
  const step = readScenarioStep(scenario);
  return {
    actionId: scenario.definition.actionId,
    adapterId: ACTION_ADAPTER_ID,
    authority: ACTION_AUTHORITY,
    commandId: scenario.commandId,
    markerState: step.markerState,
    orderId: scenario.orderId,
    ...(step.progressPercent === undefined ? {} : { progressPercent: step.progressPercent }),
    ...(step.reason === undefined
      ? {}
      : {
          reasonCode: step.reason.code,
          reasonDetail: step.reason.detail,
          reasonSource: step.reason.source,
        }),
    status: "accepted",
    targetEntityId: TARGET_ENTITY_ID,
    targetLabel: TARGET_LABEL,
  };
}

function readScenarioStep(scenario: ActiveScenario): ScenarioStep {
  const step = scenario.definition.steps[scenario.stepIndex] ?? scenario.definition.steps[0];
  if (step === undefined) {
    throw new Error(`Scenario ${scenario.commandId} is missing reviewed projection steps.`);
  }

  return step;
}

function readRequiredEntity(readModel: WorldReadModel, entityId: string): WorldEntityReadModel {
  for (const entity of readModel.entities) {
    if (entity.entityId === entityId) {
      return entity;
    }
  }

  throw new Error(`Expected entity ${entityId} in reviewed playable projection.`);
}

function createBaseReadModel(): WorldReadModel {
  const nextEntities = WEB_PRODUCT_GATE_READ_MODEL.entities.map((entity) => {
    if (entity.entityId === LAMP_OWNER_ENTITY_ID) {
      return {
        ...entity,
        inspector: {
          ...entity.inspector,
          currentJob: "Lamp refill",
          currentStep: "Waiting for the next reviewed order",
          healthLabel: "Unhurt",
        },
        summary: "Watching the east market post for the next reviewed lamp order.",
        tile: LAMP_START_TILE,
      };
    }

    if (entity.entityId === BUILD_OWNER_ENTITY_ID) {
      return {
        ...entity,
        inspector: {
          ...entity.inspector,
          currentJob: "Build construction",
          currentStep: "Waiting for the next reviewed order",
        },
        summary: "Waiting by the stockpile for the next reviewed build order.",
        tile: BUILD_START_TILE,
      };
    }

    return entity;
  });

  nextEntities.push({
    colorHex: 0xf7c66b,
    displayName: TARGET_LABEL,
    entityId: TARGET_ENTITY_ID,
    inspector: {
      currentJob: "Await reviewed work",
      currentStep: "Waiting for the next reviewed order",
      explainers: [
        "This structure stays read-only in Web and only mirrors reviewed projection updates.",
      ],
      healthLabel: "Stable",
      lastDecision: "Wait for the next reviewed command marker.",
      moodLabel: "Ready",
      needs: [],
      roleLabel: "Lamp corridor target",
      thoughts: ["Command feedback should read from the map first, then the inspector."],
    },
    kind: "structure",
    summary: "Reviewed work target for lamp refill and build orders.",
    tile: TARGET_TILE,
  });

  return {
    ...WEB_PRODUCT_GATE_READ_MODEL,
    entities: nextEntities,
    jobMarkers: [],
    selectedEntityId: WM0151_DEFAULT_SELECTED_ENTITY_ID,
  };
}

function formatJobKind(jobKind: WorldStructuredJobKind): string {
  switch (jobKind) {
    case "lamp_refill":
      return "Lamp refill";
    case "build_site_delivery":
      return "Build delivery";
    case "build_site_construction":
      return "Build construction";
  }
}

function createPathSlice(
  pathTiles: readonly TileCoordinate[],
  startIndex: number,
): readonly TileCoordinate[] {
  const slice = pathTiles.slice(startIndex);
  return slice.length > 0 ? slice : [TARGET_TILE];
}

function createTile(x: number, y: number): TileCoordinate {
  return {
    x,
    y,
  };
}

function padSequence(sequence: number): string {
  return String(sequence).padStart(3, "0");
}
