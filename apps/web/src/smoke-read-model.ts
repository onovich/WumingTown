import type { TerrainKind, WorldChunkReadModel, WorldReadModel } from "@wuming-town/sim-protocol";

const CHUNK_SIZE = 8;
const MAP_WIDTH = 24;
const MAP_HEIGHT = 16;
const TILE_SIZE = 32;

export const WEB_SHELL_SMOKE_READ_MODEL: WorldReadModel = {
  sessionId: "wm-0003-shell-smoke",
  mapName: "South Lantern District",
  tileSize: TILE_SIZE,
  chunkSize: CHUNK_SIZE,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  town: {
    settlementName: "无明镇",
    phaseLabel: "黄昏总览",
    cycleLabel: "第三夜",
    speedLabel: "Authoritative feed idle",
    alerts: [
      {
        severity: "warning",
        label: "Lantern gap",
        detail: "East street fuel window under 3h",
      },
      {
        severity: "stable",
        label: "Visitors arriving",
        detail: "North gate queue remains calm",
      },
    ],
    resources: [
      {
        label: "Rice",
        amount: 23,
        unit: "d",
        trend: "steady",
      },
      {
        label: "Lamp oil",
        amount: 9,
        unit: "c",
        trend: "falling",
      },
      {
        label: "Medicinals",
        amount: 4,
        unit: "k",
        trend: "rising",
      },
    ],
  },
  chunks: createSmokeChunks(),
  entities: [
    {
      entityId: "caretaker-shenmo",
      displayName: "沈墨",
      kind: "lantern-keeper",
      tile: {
        x: 6,
        y: 8,
      },
      colorHex: 0xf4d35e,
      summary: "Patrolling the market lantern route",
      inspector: {
        roleLabel: "守灯人",
        currentJob: "Lantern patrol",
        currentStep: "Refuel market corridor",
        moodLabel: "Focused",
        healthLabel: "Stable",
        lastDecision: "Prioritize the east corridor before curfew.",
        explainers: [
          "Fuel reserve there is lowest within the active lantern net.",
          "Visitor traffic is still clustering near the market archway.",
        ],
        thoughts: [
          "Keep the tea lane visible before the watch bell.",
          "Do not leave the granary alley dark during handoff.",
        ],
        needs: [
          {
            label: "Rest",
            value: 34,
            state: "steady",
          },
          {
            label: "Fuel buffer",
            value: 68,
            state: "high",
          },
          {
            label: "Warm meal",
            value: 41,
            state: "steady",
          },
        ],
      },
    },
    {
      entityId: "scribe-lin",
      displayName: "林策",
      kind: "resident",
      tile: {
        x: 13,
        y: 5,
      },
      colorHex: 0x84dcc6,
      summary: "Updating the evening debt ledger",
      inspector: {
        roleLabel: "镇志书吏",
        currentJob: "Ledger review",
        currentStep: "Cross-check visitor pledges",
        moodLabel: "Alert",
        healthLabel: "Unhurt",
        lastDecision: "Delay archive filing until the north gate list is complete.",
        explainers: [
          "Two pledge slips still disagree on creditor witness order.",
          "The north gate list may add one more traveler before curfew.",
        ],
        thoughts: [
          "Need the gate seal before the magistrate asks.",
          "Do not mix the shrine tithe with private debt entries.",
        ],
        needs: [
          {
            label: "Clarity",
            value: 57,
            state: "steady",
          },
          {
            label: "Quiet",
            value: 46,
            state: "steady",
          },
          {
            label: "Tea",
            value: 22,
            state: "low",
          },
        ],
      },
    },
    {
      entityId: "watcher-qiao",
      displayName: "乔渡",
      kind: "visitor",
      tile: {
        x: 18,
        y: 11,
      },
      colorHex: 0xe07a5f,
      summary: "Waiting near the north gate checkpoint",
      inspector: {
        roleLabel: "远客",
        currentJob: "Checkpoint hold",
        currentStep: "Await witness escort",
        moodLabel: "Guarded",
        healthLabel: "Travel-worn",
        lastDecision: "Remain by the checkpoint instead of entering the inner market.",
        explainers: [
          "Escort paperwork is incomplete for after-dark movement.",
          "Lantern coverage beyond the checkpoint is still being restored.",
        ],
        thoughts: [
          "The town keeps closer watch than the river ports.",
          "Stay visible until someone from the registry returns.",
        ],
        needs: [
          {
            label: "Shelter",
            value: 63,
            state: "high",
          },
          {
            label: "Trust",
            value: 58,
            state: "steady",
          },
          {
            label: "Food",
            value: 29,
            state: "low",
          },
        ],
      },
    },
  ],
  selectedEntityId: "caretaker-shenmo",
};

function createSmokeChunks(): readonly WorldChunkReadModel[] {
  const chunks: WorldChunkReadModel[] = [];

  for (let chunkY = 0; chunkY < MAP_HEIGHT / CHUNK_SIZE; chunkY += 1) {
    for (let chunkX = 0; chunkX < MAP_WIDTH / CHUNK_SIZE; chunkX += 1) {
      chunks.push({
        chunkId: `chunk-${String(chunkX)}-${String(chunkY)}`,
        originTile: {
          x: chunkX * CHUNK_SIZE,
          y: chunkY * CHUNK_SIZE,
        },
        width: CHUNK_SIZE,
        height: CHUNK_SIZE,
        terrain: createChunkTerrain(chunkX, chunkY),
      });
    }
  }

  return chunks;
}

function createChunkTerrain(chunkX: number, chunkY: number): readonly TerrainKind[] {
  const terrain: TerrainKind[] = [];

  for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      const globalX = chunkX * CHUNK_SIZE + localX;
      const globalY = chunkY * CHUNK_SIZE + localY;
      terrain.push(readTerrainKind(globalX, globalY));
    }
  }

  return terrain;
}

function readTerrainKind(tileX: number, tileY: number): TerrainKind {
  if (tileY === 7 || (tileY === 8 && tileX > 3 && tileX < 17)) {
    return "path";
  }

  if (tileX === 12 && tileY > 1 && tileY < 13) {
    return "path";
  }

  if (tileX > 18 && tileY < 5) {
    return "water";
  }

  if (tileX > 15 && tileY > 9) {
    return "brush";
  }

  if (tileX > 8 && tileX < 15 && tileY > 4 && tileY < 11) {
    return "lantern-glow";
  }

  return "earth";
}
