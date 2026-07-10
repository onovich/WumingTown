import { formatUint32Hex } from "./deterministic-hash";
import type { RandomStreamsSnapshot } from "./deterministic-rng";
import type {
  GameSessionOwnerGraph,
  GameSessionScenarioReferences,
} from "./game-session-initializer";
import type { GameSessionCommandQueue } from "./game-session-command-queue";
import { appendGameSessionOwnerHashFields } from "./game-session-hash-owner-fields";
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
  appendGameSessionOwnerHashFields(fields, context, "world");
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
  appendGameSessionOwnerHashFields(fields, context, "read");
  return formatUint32Hex(
    hashCanonicalWorld({
      fields,
      randomStreams: context.randomStreams.streams,
      queuedCommands: context.commandQueue.createCanonicalEntries(),
    }),
  );
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
