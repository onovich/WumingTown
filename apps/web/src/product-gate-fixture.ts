import type {
  TerrainKind,
  WorldChunkReadModel,
  WorldEntityReadModel,
  WorldReadModel,
} from "@wuming-town/sim-protocol";

const CHUNK_SIZE = 16;
const MAP_WIDTH = 192;
const MAP_HEIGHT = 192;
const TILE_SIZE = 16;

const NOTABLE_ENTITIES: readonly WorldEntityReadModel[] = [
  createEntity({
    entityId: "chronicler-lin",
    displayName: "Chronicler Lin",
    kind: "resident",
    tileX: 92,
    tileY: 84,
    colorHex: 0x84dcc6,
    summary: "Cross-checking debt ledgers and witness records before curfew.",
    roleLabel: "Chronicle office",
    currentJob: "Ledger review",
    currentStep: "Verify north-gate witness order",
    moodLabel: "Alert",
    healthLabel: "Unhurt",
    lastDecision: "Delay archive sealing until the last road guest is registered.",
    explainers: [
      "Two pledge slips still disagree on creditor witness order.",
      "The registry expects one more traveler before the bell.",
    ],
    thoughts: [
      "Keep faction debt separate from shrine records.",
      "Do not certify a guest list that still conflicts with testimony.",
    ],
    needs: [
      createNeed("Clarity", 58, "steady"),
      createNeed("Quiet", 44, "steady"),
      createNeed("Tea", 27, "low"),
    ],
  }),
  createEntity({
    entityId: "lantern-keeper-shen",
    displayName: "Lantern Keeper Shen",
    kind: "lantern-keeper",
    tileX: 72,
    tileY: 102,
    colorHex: 0xf4d35e,
    summary: "Patrolling the market corridor where the M4 lamp gap once opened.",
    roleLabel: "Lampkeeper watch",
    currentJob: "Lantern patrol",
    currentStep: "Refuel the east market corridor",
    moodLabel: "Focused",
    healthLabel: "Stable",
    lastDecision: "Protect the market lane before the gate road falls dark.",
    explainers: [
      "Fuel reserve is lowest along the old borrowed-shadow route.",
      "Visitor traffic is still clustering near the market archway.",
    ],
    thoughts: [
      "Hold the glow band across the bridge approach.",
      "Keep the granary alley visible during handoff.",
    ],
    needs: [
      createNeed("Rest", 36, "steady"),
      createNeed("Fuel buffer", 71, "high"),
      createNeed("Warm meal", 43, "steady"),
    ],
  }),
  createEntity({
    entityId: "night-watch-qiao",
    displayName: "Watch Lead Qiao",
    kind: "resident",
    tileX: 132,
    tileY: 63,
    colorHex: 0xe07a5f,
    summary: "Holding the threshold roster while third-knock warnings circulate.",
    roleLabel: "Night watch",
    currentJob: "Checkpoint hold",
    currentStep: "Reconcile invitation debt exceptions",
    moodLabel: "Guarded",
    healthLabel: "Travel-worn",
    lastDecision: "Keep the checkpoint visible instead of opening the inner lane.",
    explainers: [
      "Escort paperwork is incomplete for after-dark movement.",
      "Third-knock review still flags two guesthouse thresholds.",
    ],
    thoughts: [
      "No one crosses the gate on a verbal promise tonight.",
      "If the host list moves, the watch board must move first.",
    ],
    needs: [
      createNeed("Shelter", 63, "high"),
      createNeed("Trust", 54, "steady"),
      createNeed("Food", 32, "low"),
    ],
  }),
  createEntity({
    entityId: "guesthouse-ren",
    displayName: "Host Ren",
    kind: "resident",
    tileX: 120,
    tileY: 90,
    colorHex: 0xc084fc,
    summary: "Auditing lodging exceptions against the third-knock rule review.",
    roleLabel: "Guesthouse keeper",
    currentJob: "Threshold audit",
    currentStep: "Compare room slate with witness testimony",
    moodLabel: "Measured",
    healthLabel: "Stable",
    lastDecision: "Refuse a late-room transfer until the host ledger is confirmed.",
    explainers: [
      "The third knock only becomes safe with a confirmed rule or temporary policy.",
      "A room change would widen the invitation debt trace.",
    ],
    thoughts: [
      "The guest list must match what the watch can defend.",
      "A sealed slate is stronger than a shouted oath.",
    ],
    needs: [
      createNeed("Certainty", 62, "high"),
      createNeed("Patience", 49, "steady"),
      createNeed("Supplies", 38, "steady"),
    ],
  }),
  createEntity({
    entityId: "bridge-runner-su",
    displayName: "Bridge Runner Su",
    kind: "visitor",
    tileX: 154,
    tileY: 118,
    colorHex: 0x6dd3ce,
    summary: "Staging prepared goods before the old-bridge month-end crossing.",
    roleLabel: "Road guest",
    currentJob: "Bridge route prep",
    currentStep: "Check prepared gift pack against ledger intent",
    moodLabel: "Wary",
    healthLabel: "Stable",
    lastDecision: "Delay crossing until the prepared item is clearly for another traveler.",
    explainers: [
      "The old-bridge rule rejects self-serving toll bundles.",
      "Bridge ledgers still disagree on who the parcel belongs to.",
    ],
    thoughts: [
      "A proper gift is cheaper than a failed crossing.",
      "Merchants notice when the route stutters twice in a row.",
    ],
    needs: [
      createNeed("Shelter", 48, "steady"),
      createNeed("Trust", 66, "high"),
      createNeed("Food", 31, "low"),
    ],
  }),
  createEntity({
    entityId: "registry-bo",
    displayName: "Registry Clerk Bo",
    kind: "resident",
    tileX: 96,
    tileY: 58,
    colorHex: 0x9cc5a1,
    summary: "Maintaining identity confirmations used by the M4 borrowed-shadow prevention path.",
    roleLabel: "Registry office",
    currentJob: "Identity review",
    currentStep: "Seal confirmed witness chain",
    moodLabel: "Composed",
    healthLabel: "Unhurt",
    lastDecision: "Prioritize independent evidence classes over speed.",
    explainers: [
      "The prevention path relies on confirmed identity before activation.",
      "A weak seal today becomes a false dawn review tomorrow.",
    ],
    thoughts: [
      "Count independent classes, not louder voices.",
      "A seal only matters if the archive can defend it tomorrow.",
    ],
    needs: [
      createNeed("Focus", 55, "steady"),
      createNeed("Paper", 72, "high"),
      createNeed("Rest", 33, "low"),
    ],
  }),
  createEntity({
    entityId: "medic-fan",
    displayName: "Medic Fan",
    kind: "resident",
    tileX: 80,
    tileY: 120,
    colorHex: 0x90be6d,
    summary: "Covering infirmary stock while faction pressure pushes for faster triage.",
    roleLabel: "Medic station",
    currentJob: "Infirmary prep",
    currentStep: "Bundle lamp-safe treatment packs",
    moodLabel: "Busy",
    healthLabel: "Stable",
    lastDecision: "Reserve medicinals for verified risk lanes before market demand spikes.",
    explainers: [
      "The first-season pool can raise registration and market pressure at once.",
      "Low-risk evidence should prevent crisis escalation before treatment is scarce.",
    ],
    thoughts: [
      "A bright hall calms faster than a closed door.",
      "Do not let faction promises outrun stock counts.",
    ],
    needs: [
      createNeed("Medicinals", 67, "high"),
      createNeed("Sleep", 29, "low"),
      createNeed("Order", 52, "steady"),
    ],
  }),
  createEntity({
    entityId: "guild-agent-mei",
    displayName: "Guild Agent Mei",
    kind: "resident",
    tileX: 110,
    tileY: 128,
    colorHex: 0xf8961e,
    summary: "Negotiating lamp oil and paper routes for the Nine Inns Guild.",
    roleLabel: "Guild envoy",
    currentJob: "Supply negotiation",
    currentStep: "Trade paper for lamp oil buffer",
    moodLabel: "Calculating",
    healthLabel: "Stable",
    lastDecision: "Preserve market calm even if the bridge route slows for one night.",
    explainers: [
      "Lamp oil and paper are the tightest visible M5 bottlenecks.",
      "A stable market night matters more than one aggressive haul.",
    ],
    thoughts: [
      "Trade safety is a stronger argument than pride tonight.",
      "The guild wins if the queue stays orderly.",
    ],
    needs: [
      createNeed("Leverage", 61, "high"),
      createNeed("Trust", 47, "steady"),
      createNeed("Rest", 36, "steady"),
    ],
  }),
  createEntity({
    entityId: "contract-guide-yi",
    displayName: "Guide Yi",
    kind: "visitor",
    tileX: 58,
    tileY: 136,
    colorHex: 0x577590,
    summary: "Carrying mountain-family route memory into the bridge pressure lane.",
    roleLabel: "Contract family guide",
    currentJob: "Route briefing",
    currentStep: "Match bridge ledger to oral record",
    moodLabel: "Reserved",
    healthLabel: "Stable",
    lastDecision: "Hold the route until the record and the witness agree.",
    explainers: [
      "Old-family oral records remain valid evidence in the old-bridge lane.",
      "A mismatched memory becomes a route delay and a trust loss.",
    ],
    thoughts: [
      "Shortcuts are expensive when the bridge is listening.",
      "A true route remembers who prepared the parcel.",
    ],
    needs: [
      createNeed("Trust", 64, "high"),
      createNeed("Warmth", 37, "steady"),
      createNeed("Food", 28, "low"),
    ],
  }),
  createEntity({
    entityId: "council-lampkeeper-hou",
    displayName: "Council Seat Hou",
    kind: "resident",
    tileX: 104,
    tileY: 74,
    colorHex: 0xf9c74f,
    summary: "Holding the temporary policy lane that can legalize recovery actions.",
    roleLabel: "Council post",
    currentJob: "Policy review",
    currentStep: "Assess temporary threshold exception",
    moodLabel: "Deliberate",
    healthLabel: "Stable",
    lastDecision: "Allow only policies the watch and archive can explain tomorrow.",
    explainers: [
      "Governance hooks legalize event commands but cannot erase source facts.",
      "Temporary policy without explanation becomes hidden authority.",
    ],
    thoughts: [
      "A lawful recovery is stronger than a fast apology.",
      "Any exception must survive dawn review.",
    ],
    needs: [
      createNeed("Legitimacy", 69, "high"),
      createNeed("Calm", 41, "steady"),
      createNeed("Rest", 34, "steady"),
    ],
  }),
  createEntity({
    entityId: "archivist-sun",
    displayName: "Archivist Sun",
    kind: "resident",
    tileX: 88,
    tileY: 70,
    colorHex: 0xb8c0ff,
    summary: "Protecting name records tied to the Return-Lamp Society's trust lane.",
    roleLabel: "Return-Lamp Society",
    currentJob: "Name preservation",
    currentStep: "Confirm burial record witness stamp",
    moodLabel: "Steady",
    healthLabel: "Stable",
    lastDecision: "Keep death records visible when faction pressure asks for speed.",
    explainers: [
      "Identity records matter to both borrowed-shadow prevention and public trust.",
      "Fast anonymized filing would undercut the reviewed M4 lesson.",
    ],
    thoughts: [
      "A true name is safer than a tidy omission.",
      "The archive should outlast tonight's bargaining.",
    ],
    needs: [
      createNeed("Light", 58, "steady"),
      createNeed("Paper", 64, "high"),
      createNeed("Silence", 39, "steady"),
    ],
  }),
];

const SUPPORT_ROLES = [
  {
    entityId: "market-runner",
    displayName: "Market Runner",
    kind: "resident" as const,
    colorHex: 0xf28482,
    summary: "Routing market night bundles between archive, lamp route and bridge road.",
    roleLabel: "Market courier",
    currentJob: "Bundle relay",
    currentStep: "Carry verified parcel to bridge hold",
  },
  {
    entityId: "watch-scout",
    displayName: "Watch Scout",
    kind: "resident" as const,
    colorHex: 0x4d908e,
    summary: "Sweeping the gate ring for threshold anomalies and stalled routes.",
    roleLabel: "Perimeter watch",
    currentJob: "Perimeter sweep",
    currentStep: "Check outer path lanterns",
  },
  {
    entityId: "ledger-aide",
    displayName: "Ledger Aide",
    kind: "resident" as const,
    colorHex: 0x577590,
    summary: "Keeping witness slips sorted for the chronicler and registry offices.",
    roleLabel: "Archive aide",
    currentJob: "Slip sorting",
    currentStep: "Group witness slips by gate lane",
  },
  {
    entityId: "bridge-handler",
    displayName: "Bridge Handler",
    kind: "visitor" as const,
    colorHex: 0x43aa8b,
    summary: "Tracking prepared bridge packs and month-end reciprocity checks.",
    roleLabel: "Bridge crew",
    currentJob: "Pack staging",
    currentStep: "Mark intended recipient on route pack",
  },
  {
    entityId: "lamp-aide",
    displayName: "Lamp Aide",
    kind: "lantern-keeper" as const,
    colorHex: 0xf6bd60,
    summary: "Extending the glow band across courtyards and side streets.",
    roleLabel: "Lamp route",
    currentJob: "Glow maintenance",
    currentStep: "Refill side-court lanterns",
  },
];

export const WEB_PRODUCT_GATE_READ_MODEL: WorldReadModel = {
  sessionId: "wm-0086-web-product-gate",
  mapName: "First Season Product Gate",
  tileSize: TILE_SIZE,
  chunkSize: CHUNK_SIZE,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  town: {
    settlementName: "Wuming Town",
    phaseLabel: "M6 Web product gate harness",
    cycleLabel: "First season, curfew approach",
    speedLabel: "Read-only fixture fed from reviewed M5 evidence",
    alerts: [
      {
        severity: "warning",
        label: "Lantern corridor gap",
        detail: "Market east lane remains the weakest M4-derived glow path.",
      },
      {
        severity: "warning",
        label: "Threshold review open",
        detail: "Third-knock host list still needs council-safe confirmation.",
      },
      {
        severity: "stable",
        label: "Bridge parcels staged",
        detail: "Prepared goods remain visible for the old-bridge route check.",
      },
      {
        severity: "stable",
        label: "Faction pressure bounded",
        detail: "Negotiation, archive and patrol lanes remain in balance.",
      },
    ],
    resources: [
      createResource("Rice", 36, "d", "steady"),
      createResource("Lamp oil", 14, "c", "falling"),
      createResource("Paper seals", 11, "r", "steady"),
      createResource("Medicinals", 8, "k", "rising"),
      createResource("Bridge packs", 5, "b", "steady"),
    ],
  },
  chunks: createProductGateChunks(),
  entities: createEntities(),
  selectedEntityId: "chronicler-lin",
};

export function readWebProductGateActiveEntityCount(): number {
  return WEB_PRODUCT_GATE_READ_MODEL.entities.length;
}

function createEntities(): readonly WorldEntityReadModel[] {
  const entities = [...NOTABLE_ENTITIES];
  const supportCoordinates = [
    [44, 80],
    [56, 88],
    [68, 96],
    [80, 104],
    [92, 112],
    [104, 120],
    [116, 128],
    [128, 136],
    [140, 144],
    [152, 152],
    [72, 60],
    [84, 68],
    [96, 76],
    [108, 84],
    [120, 92],
    [132, 100],
    [144, 108],
    [156, 116],
    [168, 124],
    [64, 132],
    [76, 140],
    [88, 148],
    [100, 156],
    [112, 164],
    [124, 52],
    [136, 60],
    [148, 68],
    [160, 76],
    [52, 116],
  ] as const;

  for (let index = 0; index < supportCoordinates.length; index += 1) {
    const coordinate = supportCoordinates[index];
    const role = SUPPORT_ROLES[index % SUPPORT_ROLES.length];
    if (coordinate === undefined || role === undefined) {
      throw new Error("Expected deterministic support coordinates and roles.");
    }

    const tileX = coordinate[0];
    const tileY = coordinate[1];
    entities.push(
      createEntity({
        entityId: `${role.entityId}-${String(index + 1).padStart(2, "0")}`,
        displayName: `${role.displayName} ${String(index + 1)}`,
        kind: role.kind,
        tileX,
        tileY,
        colorHex: role.colorHex,
        summary: role.summary,
        roleLabel: role.roleLabel,
        currentJob: role.currentJob,
        currentStep: role.currentStep,
        moodLabel: index % 3 === 0 ? "Focused" : index % 3 === 1 ? "Calm" : "Busy",
        healthLabel: index % 4 === 0 ? "Stable" : "Unhurt",
        lastDecision: "Stay inside the reviewed M5 lane and keep tonight's route legible.",
        explainers: [
          "This support role helps keep the first-season market, lamp and guest flows visible.",
          "The harness keeps these roles read-only so later Web gates can measure the same slice.",
        ],
        thoughts: [
          "Hold the lane until the archive and watch agree.",
          "A visible route is safer than a fast hidden shortcut.",
        ],
        needs: [
          createNeed("Trust", 45 + (index % 20), index % 5 === 0 ? "high" : "steady"),
          createNeed("Rest", 28 + (index % 25), index % 4 === 0 ? "low" : "steady"),
          createNeed("Supplies", 34 + (index % 30), index % 3 === 0 ? "high" : "steady"),
        ],
      }),
    );
  }

  return entities;
}

function createProductGateChunks(): readonly WorldChunkReadModel[] {
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
  if (tileX > 148 && tileY > 94 && tileY < 140) {
    return "water";
  }

  if (tileX > 16 && tileX < 176 && Math.abs(tileY - 96) <= 2) {
    return "path";
  }

  if (tileY > 20 && tileY < 170 && Math.abs(tileX - 96) <= 2) {
    return "path";
  }

  if (tileX > 122 && tileX < 158 && tileY > 108 && tileY < 126) {
    return "path";
  }

  if (tileX > 70 && tileX < 124 && tileY > 64 && tileY < 126) {
    return "lantern-glow";
  }

  if (tileX > 132 && tileX < 172 && tileY > 104 && tileY < 148) {
    return "lantern-glow";
  }

  if (tileX < 22 || tileY < 18 || tileX > 176 || tileY > 174) {
    return "brush";
  }

  if ((tileX + tileY) % 19 === 0 || (tileX * 3 + tileY * 5) % 37 === 0) {
    return "brush";
  }

  return "earth";
}

function createEntity(input: {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: WorldEntityReadModel["kind"];
  readonly tileX: number;
  readonly tileY: number;
  readonly colorHex: number;
  readonly summary: string;
  readonly roleLabel: string;
  readonly currentJob: string;
  readonly currentStep: string;
  readonly moodLabel: string;
  readonly healthLabel: string;
  readonly lastDecision: string;
  readonly explainers: readonly string[];
  readonly thoughts: readonly string[];
  readonly needs: WorldEntityReadModel["inspector"]["needs"];
}): WorldEntityReadModel {
  return {
    entityId: input.entityId,
    displayName: input.displayName,
    kind: input.kind,
    tile: {
      x: input.tileX,
      y: input.tileY,
    },
    colorHex: input.colorHex,
    summary: input.summary,
    inspector: {
      roleLabel: input.roleLabel,
      currentJob: input.currentJob,
      currentStep: input.currentStep,
      moodLabel: input.moodLabel,
      healthLabel: input.healthLabel,
      lastDecision: input.lastDecision,
      explainers: input.explainers,
      thoughts: input.thoughts,
      needs: input.needs,
    },
  };
}

function createNeed(
  label: string,
  value: number,
  state: WorldEntityReadModel["inspector"]["needs"][number]["state"],
): WorldEntityReadModel["inspector"]["needs"][number] {
  return {
    label,
    value,
    state,
  };
}

function createResource(
  label: string,
  amount: number,
  unit: string,
  trend: WorldReadModel["town"]["resources"][number]["trend"],
): WorldReadModel["town"]["resources"][number] {
  return {
    label,
    amount,
    unit,
    trend,
  };
}
