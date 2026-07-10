import { formatUint32Hex } from "./deterministic-hash";
import type { RandomStreamsSnapshot } from "./deterministic-rng";
import type {
  GameSessionOwnerGraph,
  GameSessionScenarioReferences,
} from "./game-session-initializer";
import type { GameSessionCommandQueue } from "./game-session-command-queue";
import type { GameSessionScenarioDefinition } from "./game-session-types";
import type { RunnerSpeed, Tick } from "./time";
import {
  hashCanonicalWorld,
  type CanonicalWorldField,
  type CanonicalWorldHashInput,
} from "./world-hash";

export interface GameSessionHashContext {
  readonly definition: GameSessionScenarioDefinition;
  readonly owners: GameSessionOwnerGraph;
  readonly references: GameSessionScenarioReferences;
  readonly tick: Tick;
  readonly paused: boolean;
  readonly requestedSpeed: RunnerSpeed;
  readonly commandQueue: GameSessionCommandQueue;
  readonly randomStreams: RandomStreamsSnapshot;
}

export function createGameSessionCanonicalHashInput(
  context: GameSessionHashContext,
): CanonicalWorldHashInput {
  const fields = createSessionFields(context);
  appendResidentFields(fields, context);
  appendResourceFields(fields, context);
  appendFixtureFields(fields, context);
  return {
    fields,
    randomStreams: context.randomStreams.streams,
    queuedCommands: context.commandQueue.createCanonicalEntries(),
  };
}

export function createGameSessionWorldHash(context: GameSessionHashContext): string {
  return formatUint32Hex(hashCanonicalWorld(createGameSessionCanonicalHashInput(context)));
}

export function createGameSessionReadModelHash(context: GameSessionHashContext): string {
  const fields: CanonicalWorldField[] = [
    { name: "read.tick", value: context.tick },
    { name: "read.paused", value: context.paused },
    { name: "read.requestedSpeed", value: context.requestedSpeed },
    { name: "read.contentManifestHash", value: context.definition.contentManifestHash },
  ];
  appendResidentFields(fields, context, "read");
  appendResourceFields(fields, context, "read");
  const lamp = context.owners.lamps.readLamp(0);
  const build = context.owners.buildSites.readBuildOrder(0, context.owners.reservations);
  fields.push({ name: "read.lampFuel", value: lamp?.fuel ?? 0 });
  fields.push({ name: "read.lampMaintenance", value: lamp?.maintenanceState ?? 0 });
  fields.push({ name: "read.buildProgress", value: build?.buildProgressTicks ?? 0 });
  fields.push({ name: "read.buildComplete", value: build?.completed ?? false });
  return formatUint32Hex(hashCanonicalWorld({ fields, randomStreams: [], queuedCommands: [] }));
}

function createSessionFields(context: GameSessionHashContext): CanonicalWorldField[] {
  const { owners } = context;
  return [
    { name: "session.version", value: 1 },
    { name: "session.scenarioId", value: context.definition.scenarioId },
    { name: "session.contentManifestHash", value: context.definition.contentManifestHash },
    { name: "session.tick", value: context.tick },
    { name: "session.paused", value: context.paused },
    { name: "session.requestedSpeed", value: context.requestedSpeed },
    { name: "session.commandCursor", value: context.commandQueue.appliedCount },
    { name: "session.commandHash", value: context.commandQueue.rollingHash },
    { name: "owner.entityCount", value: owners.entities.activeCount },
    { name: "owner.mapWidth", value: owners.map.width },
    { name: "owner.mapHeight", value: owners.map.height },
    { name: "owner.mapVersion", value: owners.map.globalVersion },
    { name: "owner.locationVersion", value: owners.locations.version },
    { name: "owner.residentVersion", value: owners.residents.version },
    { name: "owner.itemVersion", value: owners.items.version },
    { name: "owner.jobVersion", value: owners.jobs.version },
    { name: "owner.reservationVersion", value: owners.reservations.version },
    { name: "owner.needVersion", value: owners.needs.version },
    { name: "owner.restVersion", value: owners.restFixtures.version },
    { name: "owner.lampVersion", value: owners.lamps.ownerVersion },
    { name: "owner.buildVersion", value: owners.buildSites.version },
    { name: "owner.workOfferCount", value: owners.workOffers.activeOfferCount },
  ];
}

function appendResidentFields(
  fields: CanonicalWorldField[],
  context: GameSessionHashContext,
  namespace = "resident",
): void {
  for (let residentId = 0; residentId < context.owners.residents.activeCount; residentId += 1) {
    const resident = context.owners.residents.read(residentId);
    if (resident === undefined) continue;
    const location = context.owners.locations.read(resident.entity, context.owners.entities);
    const needs = context.owners.needs.readActorNeeds(residentId);
    const prefix = `${namespace}.resident.${String(residentId)}`;
    fields.push({ name: `${prefix}.entityIndex`, value: resident.entity.index });
    fields.push({ name: `${prefix}.entityGeneration`, value: resident.entity.generation });
    fields.push({ name: `${prefix}.defId`, value: resident.defId });
    fields.push({ name: `${prefix}.cell`, value: location.ok ? location.location.cellIndex : -1 });
    fields.push({ name: `${prefix}.activity`, value: resident.activity });
    fields.push({ name: `${prefix}.reason`, value: resident.reason });
    fields.push({ name: `${prefix}.hunger`, value: needs?.hunger ?? 0 });
    fields.push({ name: `${prefix}.rest`, value: needs?.rest ?? 0 });
  }
}

function appendResourceFields(
  fields: CanonicalWorldField[],
  context: GameSessionHashContext,
  namespace = "resource",
): void {
  for (let slot = 0; slot < context.references.resourceStackIds.length; slot += 1) {
    const stackId = context.references.resourceStackIds[slot];
    const stack =
      stackId === undefined
        ? undefined
        : context.owners.items.readStack(stackId, context.owners.reservations);
    if (stack === undefined) continue;
    const prefix = `${namespace}.resource.${String(slot)}`;
    fields.push({ name: `${prefix}.defId`, value: stack.defId });
    fields.push({ name: `${prefix}.quantity`, value: stack.quantity });
    fields.push({ name: `${prefix}.reserved`, value: stack.reservedQuantity });
  }
}

function appendFixtureFields(fields: CanonicalWorldField[], context: GameSessionHashContext): void {
  for (let fixtureId = 0; fixtureId < context.references.bedEntities.length; fixtureId += 1) {
    const fixture = context.owners.restFixtures.readFixture(fixtureId);
    if (fixture === undefined) continue;
    const prefix = `fixture.bed.${String(fixtureId)}`;
    fields.push({ name: `${prefix}.entityIndex`, value: fixture.entity.index });
    fields.push({ name: `${prefix}.cell`, value: fixture.targetCellIndex });
    fields.push({ name: `${prefix}.version`, value: fixture.ownerVersion });
  }

  fields.push({ name: "fixture.lamp.entityIndex", value: context.references.lampEntity.index });
  fields.push({
    name: "fixture.buildSite.entityIndex",
    value: context.references.buildSiteEntity.index,
  });
}
