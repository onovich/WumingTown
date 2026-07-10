import { createBuildSiteStore, type BuildSiteStore } from "./build-site";
import { createEntityRegistry, type EntityId, type EntityRegistry } from "./entity-id";
import {
  createGameSessionResidentStore,
  type GameSessionResidentStore,
} from "./game-session-residents";
import {
  PR1_RESOURCE_FOOD,
  PR1_RESOURCE_LAMP_OIL,
  PR1_RESOURCE_STONE,
  PR1_RESOURCE_WOOD,
  type GameSessionScenarioDefinition,
} from "./game-session-types";
import { createItemStackStore, type ItemStackStore } from "./item-stack-store";
import { createJobCoreStore, type JobCoreStore } from "./job-core";
import { createLocationStore, type LocationStore } from "./location-store";
import { createM3EnvironmentStore, type M3EnvironmentStore } from "./m3-environment";
import {
  createNeedStore,
  createNeedUrgencyIndex,
  type NeedStore,
  type NeedUrgencyIndex,
} from "./m3-needs";
import {
  createRestCandidateIndex,
  createRestSleepStore,
  type RestCandidateIndex,
  type RestSleepStore,
} from "./m3-rest-sleep";
import { createM4LampNetworkStore, type M4LampNetworkStore } from "./m4-lamp-network";
import { createMapGrid, type MapGrid } from "./map-grid";
import {
  createGridPathfinder,
  createPathRequestBatcher,
  type GridPathfinder,
  type PathRequestBatcher,
} from "./pathing";
import { createReservationLedger, type ReservationLedger } from "./reservation-ledger";
import { setupGameSessionOwners } from "./game-session-owner-setup";
import { createStorageLogisticsIndex, type StorageLogisticsIndex } from "./storage-logistics-index";
import {
  createReasonTraceStore,
  createWorkOfferIndex,
  type ReasonTraceStore,
  type WorkOfferIndex,
} from "./work-offers";

const ENTITY_CAPACITY = 64;
const JOB_CAPACITY = 64;
const RESOURCE_CAPACITY = 8;

export type GameSessionInitializationReason =
  | "game_session.scenario_invalid"
  | "game_session.entity_capacity_exhausted"
  | "game_session.location_setup_failed"
  | "game_session.resident_setup_failed"
  | "game_session.resource_setup_failed"
  | "game_session.storage_setup_failed"
  | "game_session.rest_setup_failed"
  | "game_session.lamp_setup_failed"
  | "game_session.build_setup_failed"
  | "game_session.derived_index_rebuild_failed";

export interface GameSessionScenarioReferences {
  readonly resourceStackIds: readonly number[];
  readonly resourceStackEntities: readonly EntityId[];
  readonly resourceStorageEntities: readonly EntityId[];
  readonly bedEntities: readonly EntityId[];
  readonly lampEntity: EntityId;
  readonly buildSiteEntity: EntityId;
}

export interface GameSessionOwnerGraph {
  readonly entities: EntityRegistry;
  readonly map: MapGrid;
  readonly locations: LocationStore;
  readonly residents: GameSessionResidentStore;
  readonly items: ItemStackStore;
  readonly storage: StorageLogisticsIndex;
  readonly jobs: JobCoreStore;
  readonly reservations: ReservationLedger;
  readonly workOffers: WorkOfferIndex;
  readonly workReasonTraces: ReasonTraceStore;
  readonly pathfinder: GridPathfinder;
  readonly pathRequests: PathRequestBatcher;
  readonly needs: NeedStore;
  readonly needUrgency: NeedUrgencyIndex;
  readonly restFixtures: RestSleepStore;
  readonly restCandidates: RestCandidateIndex;
  readonly environment: M3EnvironmentStore;
  readonly lamps: M4LampNetworkStore;
  readonly buildSites: BuildSiteStore;
}

export interface GameSessionOwnerGraphFailure {
  readonly ok: false;
  readonly reason: GameSessionInitializationReason;
  readonly stageIndex: number;
}

export type GameSessionOwnerGraphResult =
  | {
      readonly ok: true;
      readonly definition: GameSessionScenarioDefinition;
      readonly owners: GameSessionOwnerGraph;
      readonly references: GameSessionScenarioReferences;
    }
  | GameSessionOwnerGraphFailure;

export function initializeGameSessionOwnerGraph(
  input: GameSessionScenarioDefinition,
): GameSessionOwnerGraphResult {
  const definition = cloneAndValidateDefinition(input);
  if (definition === undefined) {
    return { ok: false, reason: "game_session.scenario_invalid", stageIndex: 0 };
  }

  const entities = createEntityRegistry({ capacity: ENTITY_CAPACITY });
  const map = createMapGrid({
    width: definition.mapWidth,
    height: definition.mapHeight,
    chunkSize: definition.mapChunkSize,
  });
  const reservations = createReservationLedger({
    capacity: 128,
    entityCapacity: ENTITY_CAPACITY,
    cellCount: map.cellCount,
  });
  const locations = createLocationStore({
    capacity: ENTITY_CAPACITY,
    width: map.width,
    height: map.height,
    chunkSize: map.chunkSize,
    regionCapacity: 2,
    lifecycleHooks: reservations,
  });
  const owners = createOwnerStores(definition, entities, map, locations, reservations);
  const setup = setupGameSessionOwners(definition, owners);
  if (!setup.ok) return setup;
  return { ok: true, definition, owners, references: setup.references };
}

function createOwnerStores(
  definition: GameSessionScenarioDefinition,
  entities: EntityRegistry,
  map: MapGrid,
  locations: LocationStore,
  reservations: ReservationLedger,
): GameSessionOwnerGraph {
  const pathfinder = createGridPathfinder(map.cellCount);
  return {
    entities,
    map,
    locations,
    residents: createGameSessionResidentStore(definition.residents.length),
    items: createItemStackStore(RESOURCE_CAPACITY),
    storage: createStorageLogisticsIndex(RESOURCE_CAPACITY, RESOURCE_CAPACITY, 256),
    jobs: createJobCoreStore({ capacity: JOB_CAPACITY }),
    reservations,
    workOffers: createWorkOfferIndex({
      capacity: 32,
      workTypeCapacity: 4,
      regionCapacity: 2,
      defCapacity: 256,
      urgencyBucketCount: 4,
      permissionCapacity: 2,
    }),
    workReasonTraces: createReasonTraceStore(64),
    pathfinder,
    pathRequests: createPathRequestBatcher(16, pathfinder),
    needs: createNeedStore({ actorCapacity: definition.residents.length, updateIntervalTicks: 30 }),
    needUrgency: createNeedUrgencyIndex({ actorCapacity: definition.residents.length }),
    restFixtures: createRestSleepStore(definition.beds.length, 2, 2),
    restCandidates: createRestCandidateIndex({
      fixtureCapacity: definition.beds.length,
      regionCapacity: 2,
      permissionCapacity: 2,
    }),
    environment: createM3EnvironmentStore(),
    lamps: createM4LampNetworkStore({ lampCapacity: 4, groupCapacity: 2, dirtyCapacity: 4 }),
    buildSites: createBuildSiteStore(4, JOB_CAPACITY),
  };
}

function cloneAndValidateDefinition(
  input: GameSessionScenarioDefinition,
): GameSessionScenarioDefinition | undefined {
  if (
    input.scenarioId.length === 0 ||
    input.contentManifestHash.length === 0 ||
    !isPositive(input.mapWidth) ||
    !isPositive(input.mapHeight) ||
    !isPositive(input.mapChunkSize) ||
    input.mapWidth !== 64 ||
    input.mapHeight !== 64 ||
    input.mapChunkSize !== 8 ||
    input.residents.length < 8 ||
    input.residents.length > 16 ||
    input.beds.length < 8 ||
    input.beds.length > 16 ||
    input.resources.length !== 4 ||
    !hasRequiredResources(input) ||
    !hasValidScenarioRows(input)
  ) {
    return undefined;
  }

  return Object.freeze({
    ...input,
    residents: Object.freeze(copyRows(input.residents)),
    resources: Object.freeze(copyRows(input.resources)),
    beds: Object.freeze(copyRows(input.beds)),
    lamp: Object.freeze({ ...input.lamp }),
    buildSite: Object.freeze({ ...input.buildSite }),
  });
}

function hasValidScenarioRows(input: GameSessionScenarioDefinition): boolean {
  for (const resident of input.residents) {
    if (
      !isUint32Below(resident.defId, 256) ||
      !isMapCoordinate(resident.x, input.mapWidth) ||
      !isMapCoordinate(resident.y, input.mapHeight) ||
      !isNeedValue(resident.hunger) ||
      !isNeedValue(resident.rest) ||
      !isNeedValue(resident.comfort) ||
      !isNeedValue(resident.social) ||
      !isNeedValue(resident.safety)
    ) {
      return false;
    }
  }

  for (const resource of input.resources) {
    if (
      !isUint32Below(resource.defId, 256) ||
      !isPositive(resource.quantity) ||
      !isPositive(resource.capacity) ||
      resource.quantity > resource.capacity ||
      !isMapCoordinate(resource.storageX, input.mapWidth) ||
      !isMapCoordinate(resource.storageY, input.mapHeight)
    ) {
      return false;
    }
  }

  for (const bed of input.beds) {
    if (!isMapCoordinate(bed.x, input.mapWidth) || !isMapCoordinate(bed.y, input.mapHeight)) {
      return false;
    }
  }

  return (
    isMapCoordinate(input.lamp.x, input.mapWidth) &&
    isMapCoordinate(input.lamp.y, input.mapHeight) &&
    isPositive(input.lamp.fuel) &&
    isPositive(input.lamp.wick) &&
    input.buildSite.anchorY === 0 &&
    isMapCoordinate(input.buildSite.anchorX - 1, input.mapWidth) &&
    isMapCoordinate(input.buildSite.anchorX + 1, input.mapWidth) &&
    isPositive(input.buildSite.requiredWood) &&
    isPositive(input.buildSite.requiredStone) &&
    isPositive(input.buildSite.buildRequiredTicks) &&
    isUint32Below(input.buildSite.blueprintDefId, 256)
  );
}

function hasRequiredResources(input: GameSessionScenarioDefinition): boolean {
  let mask = 0;
  for (const resource of input.resources) {
    if (resource.defId === PR1_RESOURCE_FOOD) mask |= 1;
    else if (resource.defId === PR1_RESOURCE_WOOD) mask |= 2;
    else if (resource.defId === PR1_RESOURCE_STONE) mask |= 4;
    else if (resource.defId === PR1_RESOURCE_LAMP_OIL) mask |= 8;
  }
  return mask === 15;
}

function copyRows<T extends object>(rows: readonly T[]): T[] {
  const copied: T[] = [];
  for (const row of rows) copied.push(Object.freeze({ ...row }));
  return copied;
}

function isPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isMapCoordinate(value: number, limit: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < limit;
}

function isNeedValue(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isUint32Below(value: number, limit: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < limit;
}
