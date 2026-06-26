export const M5_WORKER_ALPHA_CONTENT_SCENARIO_ID = "m5.alpha_content_framework.first_season.v1";
export const M5_WORKER_ALPHA_CONTENT_ALIAS = "m5-alpha-content-framework";
export const M5_WORKER_REQUESTED_SEED = "5";
export const M5_WORKER_AUTHORITATIVE_SEED = "155";
export const M5_WORKER_CONTENT_MANIFEST_HASH = "0xe55d3015";
export const M5_WORKER_COMMAND_STREAM_HASH = "0x81d37435";
export const M5_WORKER_SAVE_TICK = 12_000;
export const M5_WORKER_FINAL_TICK = 36_000;
export const M5_WORKER_COMMAND_PREFIX = "m5.alpha-content-framework.advance.";

export const M5_WORKER_REPLAY_CHECKPOINT_SEQUENCE: readonly number[] = Object.freeze([
  0,
  3_600,
  7_200,
  M5_WORKER_SAVE_TICK,
  18_000,
  M5_WORKER_FINAL_TICK,
]);

export const M5_WORKER_REBUILT_SURFACE_NAMES: readonly string[] = Object.freeze([
  "anomaly-roster",
  "borrowed-shadow",
  "third-knock",
  "old-bridge",
  "faction-governance",
  "season-events",
  "content-validation",
  "work-offers",
  "path",
  "read-model",
  "review",
  "metrics",
]);

export interface M5WorkerProjectionSurface {
  readonly name: string;
  readonly hash: string;
  readonly sourceVersion: number;
}

export interface M5WorkerProjection {
  readonly scenarioId: typeof M5_WORKER_ALPHA_CONTENT_SCENARIO_ID;
  readonly requestedSeed: string;
  readonly seed: typeof M5_WORKER_AUTHORITATIVE_SEED;
  readonly tick: number;
  readonly contentManifestHash: typeof M5_WORKER_CONTENT_MANIFEST_HASH;
  readonly commandStreamHash: typeof M5_WORKER_COMMAND_STREAM_HASH;
  readonly worldHash: string;
  readonly authoritativeReadModelHash: string;
  readonly projectionHash: string;
  readonly detailHash: string;
  readonly entityCount: number;
  readonly anomalyCount: number;
  readonly strategyPathCount: number;
  readonly thirdKnockReviewReason: string;
  readonly oldBridgeReviewReason: string;
  readonly seasonSelectionCount: number;
  readonly summaries: readonly string[];
  readonly rebuiltSurfaceNames: readonly string[];
  readonly rebuiltSurfaces: readonly M5WorkerProjectionSurface[];
  readonly rebuiltIndexHash: string;
}

export interface M5WorkerFocusedSaveEnvelope {
  readonly scenarioId: typeof M5_WORKER_ALPHA_CONTENT_SCENARIO_ID;
  readonly createdTick: number;
  readonly sections: {
    readonly commandLogTail: {
      readonly checkpointWorldHash: string;
    };
  };
}

interface M5WorkerCheckpoint {
  readonly tick: number;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly projectionHash: string;
  readonly detailHash: string;
  readonly rebuiltIndexHash: string;
  readonly surfaceHashes: readonly string[];
}

const M5_WORKER_CHECKPOINTS: readonly M5WorkerCheckpoint[] = Object.freeze([
  {
    tick: 0,
    worldHash: "0xc2a4c9bc",
    readModelHash: "0x8ad12cd7",
    projectionHash: "0xa277bc4a",
    detailHash: "0x6ef1a7e5",
    rebuiltIndexHash: "0x93994367",
    surfaceHashes: Object.freeze([
      "0xd9a20c3d",
      "0x95e65d4f",
      "0x359bbbf6",
      "0xe702ae7b",
      "0xc93e659d",
      "0x2461d43d",
      "0xf63f3b75",
      "0x3c5df36f",
      "0x3fd73b21",
      "0xb7d6d2f4",
      "0x0439acf8",
      "0xf01689e1",
    ]),
  },
  {
    tick: 3_600,
    worldHash: "0x26103b4c",
    readModelHash: "0xfe3a4987",
    projectionHash: "0xa00c64c8",
    detailHash: "0x26a460d5",
    rebuiltIndexHash: "0xda5278cf",
    surfaceHashes: Object.freeze([
      "0xa81409d0",
      "0x61a3ed26",
      "0x38d7aa33",
      "0xfbebab42",
      "0xf161f870",
      "0x7759f1d0",
      "0xa935dce8",
      "0xd55a4306",
      "0x20c84fb4",
      "0xd8c3f1ed",
      "0xde7f1a51",
      "0x4aa0c6f4",
    ]),
  },
  {
    tick: 7_200,
    worldHash: "0x687c43dc",
    readModelHash: "0x328c0a37",
    projectionHash: "0xda3a96c2",
    detailHash: "0x4b5f6605",
    rebuiltIndexHash: "0x172f09e2",
    surfaceHashes: Object.freeze([
      "0x0d965c0f",
      "0x81b02a61",
      "0x1748ac98",
      "0x77ba06fd",
      "0x115477af",
      "0xe6f3f40f",
      "0x903447e7",
      "0x3c957941",
      "0x7c617463",
      "0x9c202b9e",
      "0x3d5da332",
      "0xa67784a3",
    ]),
  },
  {
    tick: M5_WORKER_SAVE_TICK,
    worldHash: "0xc359959c",
    readModelHash: "0x7f02f3f7",
    projectionHash: "0x288b1f05",
    detailHash: "0xabc28fc5",
    rebuiltIndexHash: "0xabacc7de",
    surfaceHashes: Object.freeze([
      "0x2cea3e47",
      "0x8c8f8149",
      "0xa50fd874",
      "0xb854c305",
      "0x06128827",
      "0x260f4647",
      "0x3e163fef",
      "0xd8b35469",
      "0x8fef531b",
      "0xa2ef272a",
      "0xaf488aee",
      "0xdd84d6db",
    ]),
  },
  {
    tick: 18_000,
    worldHash: "0xb522fc8c",
    readModelHash: "0x844ccdc7",
    projectionHash: "0x0b65745f",
    detailHash: "0xbff75d15",
    rebuiltIndexHash: "0xd3ba1062",
    surfaceHashes: Object.freeze([
      "0xe57e9f57",
      "0x6b2bcabd",
      "0x16237ae0",
      "0xc24555b9",
      "0x4b06dbb7",
      "0x4582f757",
      "0xaf0f7d9f",
      "0x7908e9dd",
      "0x28ae338b",
      "0xf00d9afa",
      "0xf411855e",
      "0xe07f614b",
    ]),
  },
  {
    tick: M5_WORKER_FINAL_TICK,
    worldHash: "0x9a4a905c",
    readModelHash: "0x57eba2b7",
    projectionHash: "0xc6420cb1",
    detailHash: "0x51c64d85",
    rebuiltIndexHash: "0xdf7329d2",
    surfaceHashes: Object.freeze([
      "0x16783d79",
      "0x35ed3af7",
      "0x6d209d6a",
      "0x85b6d86b",
      "0xd83a2ad9",
      "0x97605579",
      "0x2023cad1",
      "0x25124a17",
      "0x8feac135",
      "0xd752a4c4",
      "0x406fa6b0",
      "0x14caec75",
    ]),
  },
]);

export function createM5WorkerProjection(
  requestedSeed: string,
  tick: number,
): M5WorkerProjection | undefined {
  if (requestedSeed !== M5_WORKER_REQUESTED_SEED) {
    return undefined;
  }

  const checkpoint = readM5WorkerCheckpoint(tick);
  if (checkpoint === undefined) {
    return undefined;
  }

  return {
    scenarioId: M5_WORKER_ALPHA_CONTENT_SCENARIO_ID,
    requestedSeed,
    seed: M5_WORKER_AUTHORITATIVE_SEED,
    tick: checkpoint.tick,
    contentManifestHash: M5_WORKER_CONTENT_MANIFEST_HASH,
    commandStreamHash: M5_WORKER_COMMAND_STREAM_HASH,
    worldHash: checkpoint.worldHash,
    authoritativeReadModelHash: checkpoint.readModelHash,
    projectionHash: checkpoint.projectionHash,
    detailHash: checkpoint.detailHash,
    entityCount: 7,
    anomalyCount: 3,
    strategyPathCount: 4,
    thirdKnockReviewReason: "third_knock_resolved_contained",
    oldBridgeReviewReason: "old_bridge_resolved_reciprocity",
    seasonSelectionCount: 5,
    summaries: Object.freeze([
      "catalog=20",
      "anomalies=3",
      "thirdKnock=third_knock_resolved_contained",
      "oldBridge=old_bridge_resolved_reciprocity",
      "seasonSelections=5",
    ]),
    rebuiltSurfaceNames: M5_WORKER_REBUILT_SURFACE_NAMES,
    rebuiltSurfaces: createM5WorkerSurfaces(checkpoint.surfaceHashes),
    rebuiltIndexHash: checkpoint.rebuiltIndexHash,
  };
}

export function createM5WorkerFocusedSaveEnvelope(
  requestedSeed: string,
  tick: number,
): M5WorkerFocusedSaveEnvelope | undefined {
  const projection = createM5WorkerProjection(requestedSeed, tick);
  if (projection === undefined) {
    return undefined;
  }

  return {
    scenarioId: M5_WORKER_ALPHA_CONTENT_SCENARIO_ID,
    createdTick: tick,
    sections: {
      commandLogTail: {
        checkpointWorldHash: projection.worldHash,
      },
    },
  };
}

export function createM5WorkerAdvanceCommandId(tick: number, sequence: number): string {
  if (!isSafeNonNegativeInteger(tick) || !isSafeNonNegativeInteger(sequence)) {
    throw new Error("M5 Worker advance command id requires safe non-negative integer fields");
  }

  return `${M5_WORKER_COMMAND_PREFIX}${String(tick)}.${String(sequence)}`;
}

export function parseM5WorkerAdvanceCommandId(
  commandId: string,
):
  | { readonly ok: true; readonly tick: number; readonly sequence: number }
  | { readonly ok: false } {
  if (!commandId.startsWith(M5_WORKER_COMMAND_PREFIX)) {
    return { ok: false };
  }

  const rest = commandId.slice(M5_WORKER_COMMAND_PREFIX.length);
  const dotIndex = rest.indexOf(".");
  if (dotIndex <= 0 || dotIndex === rest.length - 1) {
    return { ok: false };
  }

  const tick = Number.parseInt(rest.slice(0, dotIndex), 10);
  const sequence = Number.parseInt(rest.slice(dotIndex + 1), 10);
  if (!isSafeNonNegativeInteger(tick) || !isSafeNonNegativeInteger(sequence)) {
    return { ok: false };
  }

  return { ok: true, tick, sequence };
}

function readM5WorkerCheckpoint(tick: number): M5WorkerCheckpoint | undefined {
  for (const checkpoint of M5_WORKER_CHECKPOINTS) {
    if (checkpoint.tick === tick) {
      return checkpoint;
    }
  }

  return undefined;
}

function createM5WorkerSurfaces(
  surfaceHashes: readonly string[],
): readonly M5WorkerProjectionSurface[] {
  const surfaces: M5WorkerProjectionSurface[] = [];

  for (let index = 0; index < surfaceHashes.length; index += 1) {
    const name = M5_WORKER_REBUILT_SURFACE_NAMES[index];
    const hash = surfaceHashes[index];
    if (name !== undefined && hash !== undefined) {
      surfaces.push({
        name,
        hash,
        sourceVersion: index + 1,
      });
    }
  }

  return surfaces;
}

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
