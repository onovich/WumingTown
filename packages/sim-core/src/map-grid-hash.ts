import { hashStringToUint32, mixUint32 } from "./deterministic-hash";
import type { MapGridSnapshot } from "./map-grid";
import type { CanonicalWorldField } from "./world-hash";

type NumericLane = Uint8Array | Uint16Array | Uint32Array | Int32Array;

export function createMapGridHashFields(
  snapshot: MapGridSnapshot,
  prefix = "map",
): CanonicalWorldField[] {
  return [
    { name: `${prefix}.version`, value: snapshot.version },
    { name: `${prefix}.width`, value: snapshot.width },
    { name: `${prefix}.height`, value: snapshot.height },
    { name: `${prefix}.chunkSize`, value: snapshot.chunkSize },
    { name: `${prefix}.chunkColumns`, value: snapshot.chunkColumns },
    { name: `${prefix}.chunkRows`, value: snapshot.chunkRows },
    { name: `${prefix}.cellCount`, value: snapshot.cellCount },
    { name: `${prefix}.chunkCount`, value: snapshot.chunkCount },
    { name: `${prefix}.globalVersion`, value: snapshot.globalVersion },
    { name: `${prefix}.dirtyChunkCount`, value: snapshot.dirtyChunkCount },
    { name: `${prefix}.terrainHash`, value: hashLane("terrain", snapshot.terrain) },
    { name: `${prefix}.occupancyHash`, value: hashLane("occupancy", snapshot.occupancy) },
    {
      name: `${prefix}.walkCostMilliHash`,
      value: hashLane("walkCostMilli", snapshot.walkCostMilli),
    },
    { name: `${prefix}.regionIdHash`, value: hashLane("regionId", snapshot.regionId) },
    { name: `${prefix}.roomIdHash`, value: hashLane("roomId", snapshot.roomId) },
    { name: `${prefix}.cellVersionHash`, value: hashLane("cellVersion", snapshot.cellVersion) },
    {
      name: `${prefix}.chunkVersionHash`,
      value: hashLane("chunkVersion", snapshot.chunkVersion),
    },
    { name: `${prefix}.chunkDirtyHash`, value: hashLane("chunkDirty", snapshot.chunkDirty) },
    { name: `${prefix}.dirtyChunksHash`, value: hashLane("dirtyChunks", snapshot.dirtyChunks) },
  ];
}

function hashLane(name: string, lane: NumericLane): number {
  let hash = mixUint32(hashStringToUint32(`wuming-town:map-grid:${name}`), lane.length);

  for (let index = 0; index < lane.length; index += 1) {
    hash = mixUint32(hash, lane[index] ?? 0);
  }

  return hash;
}
