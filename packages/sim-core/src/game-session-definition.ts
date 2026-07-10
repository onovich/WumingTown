import {
  PR1_BLUEPRINT_SIMPLE_SHELTER,
  PR1_CONTENT_MANIFEST_HASH,
  PR1_INTEGRATED_GAME_SESSION_ID,
  PR1_RESOURCE_FOOD,
  PR1_RESOURCE_LAMP_OIL,
  PR1_RESOURCE_STONE,
  PR1_RESOURCE_WOOD,
  type GameSessionScenarioDefinition,
} from "./game-session-types";

export function createPr1IntegratedGameSessionDefinition(): GameSessionScenarioDefinition {
  const residents = [];
  const beds = [];

  for (let residentId = 0; residentId < 8; residentId += 1) {
    residents.push({
      defId: 100 + residentId,
      x: 8 + residentId,
      y: 8,
      hunger: 720 - residentId * 10,
      rest: 680 - residentId * 8,
      comfort: 700,
      social: 640 + residentId * 5,
      safety: 820,
    });
    beds.push({ x: 8 + residentId, y: 16 });
  }

  return Object.freeze({
    scenarioId: PR1_INTEGRATED_GAME_SESSION_ID,
    contentManifestHash: PR1_CONTENT_MANIFEST_HASH,
    mapWidth: 64,
    mapHeight: 64,
    mapChunkSize: 8,
    residents: Object.freeze(residents),
    resources: Object.freeze([
      createResource(PR1_RESOURCE_FOOD, 80, 160, 10),
      createResource(PR1_RESOURCE_WOOD, 60, 160, 11),
      createResource(PR1_RESOURCE_STONE, 50, 160, 12),
      createResource(PR1_RESOURCE_LAMP_OIL, 40, 120, 13),
    ]),
    beds: Object.freeze(beds),
    lamp: Object.freeze({ x: 20, y: 20, fuel: 1_000, wick: 1_000 }),
    buildSite: Object.freeze({
      anchorX: 24,
      anchorY: 0,
      requiredWood: 20,
      requiredStone: 15,
      buildRequiredTicks: 300,
      blueprintDefId: PR1_BLUEPRINT_SIMPLE_SHELTER,
    }),
  });
}

function createResource(
  defId: number,
  quantity: number,
  capacity: number,
  storageX: number,
): {
  readonly defId: number;
  readonly quantity: number;
  readonly capacity: number;
  readonly storageX: number;
  readonly storageY: number;
} {
  return Object.freeze({ defId, quantity, capacity, storageX, storageY: 13 });
}
