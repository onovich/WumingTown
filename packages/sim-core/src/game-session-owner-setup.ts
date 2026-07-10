import type { EntityId, EntityRegistry } from "./entity-id";
import type {
  GameSessionOwnerGraph,
  GameSessionOwnerGraphFailure,
  GameSessionScenarioReferences,
} from "./game-session-initializer";
import {
  PR1_RESOURCE_STONE,
  PR1_RESOURCE_WOOD,
  type GameSessionScenarioDefinition,
} from "./game-session-types";
import { M4_LAMP_MAINTENANCE_OK, M4_LAMP_TAG_HOME, M4_LAMP_TAG_ROAD } from "./m4-lamp-network";

const WORK_TYPE_STORAGE = 0;
const WORK_TYPE_BUILD_DELIVERY = 1;
const WORK_TYPE_BUILD = 2;

export type GameSessionOwnerSetupResult =
  | { readonly ok: true; readonly references: GameSessionScenarioReferences }
  | GameSessionOwnerGraphFailure;

export function setupGameSessionOwners(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
): GameSessionOwnerSetupResult {
  const residents = initializeResidents(definition, owners);
  if (!residents.ok) return residents;
  const resources = initializeResources(definition, owners);
  if (!resources.ok) return resources;
  const beds = initializeBeds(definition, owners);
  if (!beds.ok) return beds;
  const lampEntity = initializeLamp(definition, owners);
  if (!lampEntity.ok) return lampEntity;
  const buildSiteEntity = initializeBuildSite(definition, owners);
  if (!buildSiteEntity.ok) return buildSiteEntity;
  if (!rebuildInitialDerivedIndexes(definition, owners)) {
    return failure("game_session.derived_index_rebuild_failed", 6);
  }

  return {
    ok: true,
    references: Object.freeze({
      resourceStackIds: Object.freeze(resources.stackIds),
      resourceStackEntities: Object.freeze(resources.stackEntities),
      resourceStorageEntities: Object.freeze(resources.storageEntities),
      bedEntities: Object.freeze(beds.entities),
      lampEntity: lampEntity.entity,
      buildSiteEntity: buildSiteEntity.entity,
    }),
  };
}

function initializeResidents(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
): { readonly ok: true } | GameSessionOwnerGraphFailure {
  for (let residentId = 0; residentId < definition.residents.length; residentId += 1) {
    const start = definition.residents[residentId];
    const entity = allocate(owners.entities);
    if (start === undefined || entity === undefined) {
      return failure("game_session.entity_capacity_exhausted", 1);
    }

    const placed = owners.locations.placeOnMap(
      entity,
      owners.entities,
      owners.map,
      start.x,
      start.y,
    );
    const registered = owners.residents.register(residentId, entity, start.defId, owners.entities);
    const needs = owners.needs.registerActor({ actorId: residentId, ...start, sourceTick: 0 });
    if (!placed.ok || !registered.ok || !needs.ok) {
      return failure("game_session.resident_setup_failed", residentId);
    }
  }
  return { ok: true };
}

function initializeResources(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
):
  | {
      readonly ok: true;
      readonly stackIds: number[];
      readonly stackEntities: EntityId[];
      readonly storageEntities: EntityId[];
    }
  | GameSessionOwnerGraphFailure {
  const stackIds: number[] = [];
  const stackEntities: EntityId[] = [];
  const storageEntities: EntityId[] = [];

  for (let slotId = 0; slotId < definition.resources.length; slotId += 1) {
    const start = definition.resources[slotId];
    const storageEntity = allocate(owners.entities);
    const stackEntity = allocate(owners.entities);
    if (start === undefined || storageEntity === undefined || stackEntity === undefined) {
      return failure("game_session.entity_capacity_exhausted", 2);
    }

    const placed = owners.locations.placeOnMap(
      storageEntity,
      owners.entities,
      owners.map,
      start.storageX,
      start.storageY,
    );
    const contained = owners.locations.placeInContainer(
      stackEntity,
      owners.entities,
      owners.map,
      storageEntity,
      0,
    );
    const stack = owners.items.createStack(
      {
        stackId: slotId,
        entity: stackEntity,
        defId: start.defId,
        quantity: start.quantity,
        capacity: start.capacity,
      },
      owners.entities,
    );
    const storage = owners.storage.configureSlot(
      {
        slotId,
        storage: storageEntity,
        stackId: slotId,
        defId: start.defId,
        capacity: start.capacity,
        desiredQuantity: start.quantity,
        interactionCellIndex: start.storageY * definition.mapWidth + start.storageX,
        offerId: slotId,
        workType: WORK_TYPE_STORAGE,
        regionId: 0,
        urgencyBucket: 0,
        permissionId: 0,
      },
      owners.entities,
    );
    if (!placed.ok || !contained.ok || !stack.ok || !storage.ok) {
      return failure("game_session.resource_setup_failed", slotId);
    }
    stackIds.push(slotId);
    stackEntities.push(stackEntity);
    storageEntities.push(storageEntity);
  }

  return { ok: true, stackIds, stackEntities, storageEntities };
}

function initializeBeds(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
): { readonly ok: true; readonly entities: EntityId[] } | GameSessionOwnerGraphFailure {
  const entities: EntityId[] = [];
  for (let fixtureId = 0; fixtureId < definition.beds.length; fixtureId += 1) {
    const start = definition.beds[fixtureId];
    const entity = allocate(owners.entities);
    if (start === undefined || entity === undefined) {
      return failure("game_session.entity_capacity_exhausted", 3);
    }

    const placed = owners.locations.placeOnMap(
      entity,
      owners.entities,
      owners.map,
      start.x,
      start.y,
    );
    const registered = owners.restFixtures.registerFixture(
      {
        fixtureId,
        entity,
        kind: "bedroll",
        restKind: "sleep",
        regionId: 0,
        targetCellIndex: start.y * definition.mapWidth + start.x,
        interactionSpotId: fixtureId,
        scheduleWindow: "night",
        weatherExposure: "indoor",
        permissionId: 0,
        recoveryPerTickQ16: 1_024,
        baseScoreMilli: 1_000 - fixtureId,
      },
      owners.entities,
    );
    if (!placed.ok || !registered.ok) {
      return failure("game_session.rest_setup_failed", fixtureId);
    }
    entities.push(entity);
  }
  return { ok: true, entities };
}

function initializeLamp(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
): { readonly ok: true; readonly entity: EntityId } | GameSessionOwnerGraphFailure {
  const entity = allocate(owners.entities);
  if (entity === undefined) return failure("game_session.entity_capacity_exhausted", 4);
  const placed = owners.locations.placeOnMap(
    entity,
    owners.entities,
    owners.map,
    definition.lamp.x,
    definition.lamp.y,
  );
  const group = owners.lamps.registerGroup(0);
  const registered = owners.lamps.registerLampAtMapCell({
    lampId: 0,
    groupId: 0,
    cellIndex: definition.lamp.y * definition.mapWidth + definition.lamp.x,
    tagMask: M4_LAMP_TAG_HOME | M4_LAMP_TAG_ROAD,
    fuel: definition.lamp.fuel,
    wick: definition.lamp.wick,
    damage: 0,
    maintenanceState: M4_LAMP_MAINTENANCE_OK,
    humanClaim: 1_000,
    shadowGap: 0,
    map: owners.map,
  });
  if (!placed.ok || !group.ok || !registered.ok) {
    return failure("game_session.lamp_setup_failed", 0);
  }
  return { ok: true, entity };
}

function initializeBuildSite(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
): { readonly ok: true; readonly entity: EntityId } | GameSessionOwnerGraphFailure {
  const entity = allocate(owners.entities);
  if (entity === undefined) return failure("game_session.entity_capacity_exhausted", 5);
  const start = definition.buildSite;
  const created = owners.buildSites.createSite(
    {
      siteId: 0,
      site: entity,
      blueprintDefId: start.blueprintDefId,
      anchorX: start.anchorX,
      anchorY: start.anchorY,
      interactionCellA: start.anchorX - 1,
      interactionCellB: start.anchorX + 1,
      requiredDefIds: [PR1_RESOURCE_WOOD, PR1_RESOURCE_STONE],
      requiredAmounts: [start.requiredWood, start.requiredStone],
      buildRequiredTicks: start.buildRequiredTicks,
      materialOfferIds: [8, 9],
      buildOfferId: 10,
      deliverWorkType: WORK_TYPE_BUILD_DELIVERY,
      buildWorkType: WORK_TYPE_BUILD,
      regionId: 0,
      urgencyBucket: 1,
      permissionId: 0,
    },
    owners.entities,
  );
  return created.ok ? { ok: true, entity } : failure("game_session.build_setup_failed", 0);
}

function rebuildInitialDerivedIndexes(
  definition: GameSessionScenarioDefinition,
  owners: GameSessionOwnerGraph,
): boolean {
  owners.needUrgency.rebuildFromStore(owners.needs);
  owners.restCandidates.rebuildFromStore(owners.restFixtures);
  const storage = owners.storage.refreshDirty(
    owners.items,
    owners.reservations,
    owners.workOffers,
    definition.resources.length,
  );
  const build = owners.buildSites.syncOffers(0, owners.workOffers, owners.reservations);
  return storage.dirtyBacklog === 0 && build.ok;
}

function allocate(registry: EntityRegistry): EntityId | undefined {
  const allocated = registry.allocate();
  return allocated.ok ? allocated.entity : undefined;
}

function failure(
  reason: GameSessionOwnerGraphFailure["reason"],
  stageIndex: number,
): GameSessionOwnerGraphFailure {
  return { ok: false, reason, stageIndex };
}
