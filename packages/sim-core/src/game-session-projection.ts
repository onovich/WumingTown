import type {
  GameSessionOwnerGraph,
  GameSessionScenarioReferences,
} from "./game-session-initializer";
import {
  type GameSessionProjectionBasis,
  type GameSessionRenderEntity,
  type GameSessionRenderProjection,
  type GameSessionScenarioDefinition,
  type GameSessionStructuredReason,
  type GameSessionUiProjection,
  type GameSessionUiResident,
  type GameSessionUiResource,
} from "./game-session-types";
import { TICKS_PER_DAY, type RunnerSpeed, type Tick } from "./time";

const Q16_ONE = 65_536;

export interface GameSessionProjectionContext {
  readonly definition: GameSessionScenarioDefinition;
  readonly owners: GameSessionOwnerGraph;
  readonly references: GameSessionScenarioReferences;
  readonly tick: Tick;
  readonly paused: boolean;
  readonly requestedSpeed: RunnerSpeed;
  readonly basis: GameSessionProjectionBasis;
}

export function buildGameSessionRenderProjection(
  context: GameSessionProjectionContext,
): GameSessionRenderProjection {
  const entities: GameSessionRenderEntity[] = [];
  appendResidents(entities, context);
  appendResources(entities, context);
  appendBeds(entities, context);
  appendLampAndBuildSite(entities, context);
  return Object.freeze({
    readOnly: true,
    basis: context.basis,
    mapWidth: context.owners.map.width,
    mapHeight: context.owners.map.height,
    entities: Object.freeze(entities),
  });
}

export function buildGameSessionUiProjection(
  context: GameSessionProjectionContext,
): GameSessionUiProjection {
  const residents = buildUiResidents(context);
  const resources = buildUiResources(context);
  const lamp = context.owners.lamps.readLamp(0);
  const build = context.owners.buildSites.readBuildOrder(0, context.owners.reservations);
  const alerts: readonly GameSessionStructuredReason[] = Object.freeze([
    "game_session.awaiting_job_driver",
  ]);
  return Object.freeze({
    readOnly: true,
    basis: context.basis,
    paused: context.paused,
    requestedSpeed: context.requestedSpeed,
    dayIndex: Math.floor(context.tick / TICKS_PER_DAY),
    tickOfDay: context.tick % TICKS_PER_DAY,
    residents: Object.freeze(residents),
    resources: Object.freeze(resources),
    activeJobCount: context.owners.jobs.activeJobCount,
    activeReservationCount: context.owners.reservations.activeCount,
    lampFuel: lamp?.fuel ?? 0,
    lampMaintenanceState: lamp?.maintenanceState ?? 0,
    buildProgressTicks: build?.buildProgressTicks ?? 0,
    buildRequiredTicks: build?.buildRequiredTicks ?? 0,
    buildCompleted: build?.completed ?? false,
    alerts,
  });
}

function appendResidents(
  output: GameSessionRenderEntity[],
  context: GameSessionProjectionContext,
): void {
  for (let residentId = 0; residentId < context.owners.residents.activeCount; residentId += 1) {
    const resident = context.owners.residents.read(residentId);
    if (resident === undefined) continue;
    const location = context.owners.locations.read(resident.entity, context.owners.entities);
    if (!location.ok) continue;
    output.push({
      entity: resident.entity,
      kind: "resident",
      defId: resident.defId,
      xQ16: location.location.x * Q16_ONE,
      yQ16: location.location.y * Q16_ONE,
      flags: resident.activity === "idle" ? 0 : 1,
    });
  }
}

function appendResources(
  output: GameSessionRenderEntity[],
  context: GameSessionProjectionContext,
): void {
  for (let slot = 0; slot < context.references.resourceStorageEntities.length; slot += 1) {
    const entity = context.references.resourceStorageEntities[slot];
    const stackId = context.references.resourceStackIds[slot];
    if (entity === undefined || stackId === undefined) continue;
    const location = context.owners.locations.read(entity, context.owners.entities);
    const stack = context.owners.items.readStack(stackId, context.owners.reservations);
    if (!location.ok || stack === undefined) continue;
    output.push({
      entity,
      kind: "resource",
      defId: stack.defId,
      xQ16: location.location.x * Q16_ONE,
      yQ16: location.location.y * Q16_ONE,
      flags: stack.availableQuantity > 0 ? 1 : 0,
    });
  }
}

function appendBeds(
  output: GameSessionRenderEntity[],
  context: GameSessionProjectionContext,
): void {
  for (let fixtureId = 0; fixtureId < context.references.bedEntities.length; fixtureId += 1) {
    const fixture = context.owners.restFixtures.readFixture(fixtureId);
    if (fixture === undefined) continue;
    output.push({
      entity: fixture.entity,
      kind: "bed",
      defId: fixtureId,
      xQ16: (fixture.targetCellIndex % context.owners.map.width) * Q16_ONE,
      yQ16: Math.floor(fixture.targetCellIndex / context.owners.map.width) * Q16_ONE,
      flags: 0,
    });
  }
}

function appendLampAndBuildSite(
  output: GameSessionRenderEntity[],
  context: GameSessionProjectionContext,
): void {
  const lampLocation = context.owners.locations.read(
    context.references.lampEntity,
    context.owners.entities,
  );
  if (lampLocation.ok) {
    output.push({
      entity: context.references.lampEntity,
      kind: "lamp",
      defId: 0,
      xQ16: lampLocation.location.x * Q16_ONE,
      yQ16: lampLocation.location.y * Q16_ONE,
      flags: 1,
    });
  }

  output.push({
    entity: context.references.buildSiteEntity,
    kind: "build_site",
    defId: context.definition.buildSite.blueprintDefId,
    xQ16: context.definition.buildSite.anchorX * Q16_ONE,
    yQ16: context.definition.buildSite.anchorY * Q16_ONE,
    flags: 0,
  });
}

function buildUiResidents(context: GameSessionProjectionContext): GameSessionUiResident[] {
  const rows: GameSessionUiResident[] = [];
  for (let residentId = 0; residentId < context.owners.residents.activeCount; residentId += 1) {
    const resident = context.owners.residents.read(residentId);
    if (resident === undefined) continue;
    const location = context.owners.locations.read(resident.entity, context.owners.entities);
    const needs = context.owners.needs.readActorNeeds(residentId);
    if (!location.ok || needs === undefined) continue;
    rows.push({
      residentId,
      entity: resident.entity,
      defId: resident.defId,
      cellIndex: location.location.cellIndex,
      activity: resident.activity,
      currentJobId: resident.currentJobId,
      hunger: needs.hunger,
      rest: needs.rest,
      reason: resident.reason,
    });
  }
  return rows;
}

function buildUiResources(context: GameSessionProjectionContext): GameSessionUiResource[] {
  const rows: GameSessionUiResource[] = [];
  for (const stackId of context.references.resourceStackIds) {
    const stack = context.owners.items.readStack(stackId, context.owners.reservations);
    if (stack === undefined) continue;
    rows.push({
      defId: stack.defId,
      total: stack.quantity,
      available: stack.availableQuantity,
      reserved: stack.reservedQuantity,
    });
  }
  return rows;
}
