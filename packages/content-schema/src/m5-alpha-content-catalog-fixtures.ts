import type { M5ContentPack, M5ContentPackFile } from "./m5-content-validation-types";

export const M5_ALPHA_CATALOG_ENTRY_COUNT = 20;
export const M5_ALPHA_DEFINITION_COUNT = 30;

export const M5_ALPHA_APPROVED_OWNER_SURFACES = [
  "BuildSiteStore",
  "ItemStackStore",
  "JobCoreStore",
  "M4ChronicleCaseFileStore",
  "M4EvidenceFactStore",
  "M4LampNetworkStore",
  "M4ObligationStore",
  "M4TownRuleStore",
  "M5AnomalyRosterStore",
  "M5FactionFactStore",
  "M5GovernanceHookStore",
  "M5OldBridgeGuestCrisisStore",
  "M5SeasonEventPoolStore",
  "M5ThirdKnockCrisisStore",
  "StorageLogisticsIndex",
  "WorkOfferIndex",
] as const;

export const M5_ALPHA_REJECTED_FIXTURE_KINDS = [
  "building-owner-surface",
  "tag-owner-surface",
  "anomaly-evidence",
  "faction-hook-lanes",
  "season-event-cooldown",
  "missing-localization",
  "unsafe-data",
] as const;

export type M5AlphaRejectedFixtureKind = (typeof M5_ALPHA_REJECTED_FIXTURE_KINDS)[number];

export interface M5AlphaCatalogReviewNote {
  readonly defId: string;
  readonly ownerSurfaces: readonly string[];
  readonly systemValueAlternatives: readonly string[];
  readonly factionGovernanceAnomalyHooks: readonly string[];
  readonly cultureFairnessReview: string;
  readonly blockedReason?: string;
}

type M5AlphaDefinition = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly kind: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
};

interface CatalogEntryInput {
  readonly id: string;
  readonly catalogKind: string;
  readonly tags: readonly string[];
  readonly references: readonly string[];
  readonly ownerSurfaces: readonly string[];
  readonly systemValue: readonly string[];
  readonly reusableTags: readonly string[];
  readonly alternatives: readonly string[];
  readonly hooks: readonly string[];
  readonly cultureFairnessReview: string;
  readonly blockedReason?: string;
}

export function createM5AlphaContentCatalogPack(): M5ContentPack {
  return createPack(createM5AlphaDefinitions(), undefined, []);
}

export function createRejectedM5AlphaContentCatalogPack(
  kind: M5AlphaRejectedFixtureKind,
): M5ContentPack {
  if (kind === "unsafe-data") {
    return createPack(createM5AlphaDefinitions(), undefined, [
      {
        relativePath: "../escape.json",
        text: "{}\n",
      },
      {
        relativePath: "scripts/hack.js",
        text: "export const run = () => undefined;\n",
      },
    ]);
  }

  if (kind === "missing-localization") {
    return createPack(
      createM5AlphaDefinitions(),
      {
        "content.core.catalog.road_lantern.v1.description": undefined,
      },
      [],
    );
  }

  return createPack(
    patchDefinitions(createM5AlphaDefinitions(), rejectedDefinitionPatch(kind)),
    undefined,
    [],
  );
}

export function listM5AlphaCatalogReviewNotes(): readonly M5AlphaCatalogReviewNote[] {
  return CATALOG_ENTRIES.map((entry) => ({
    defId: entry.id,
    ownerSurfaces: entry.ownerSurfaces,
    systemValueAlternatives: entry.alternatives,
    factionGovernanceAnomalyHooks: entry.hooks,
    cultureFairnessReview: entry.cultureFairnessReview,
    ...(entry.blockedReason === undefined ? {} : { blockedReason: entry.blockedReason }),
  }));
}

function createM5AlphaDefinitions(): readonly M5AlphaDefinition[] {
  return [
    anomaly({
      id: "core.anomaly.borrowed_shadow.v1",
      tags: ["anomaly", "identity", "lamp"],
      ruleComponents: ["lamp_gap_identity", "chronicle_identity_evidence"],
      affectedSystems: ["lamp", "identity", "chronicle", "obligation"],
      evidenceClasses: ["lamp_trace", "witness", "household_record", "medical_note"],
      stateMachine: ["dormant", "shadow_gap", "identity_split", "resolved"],
      commonMisread: "Residents blame a lamp failure before checking identity evidence.",
      accidentReviewKeys: ["review.borrowed_shadow.identity", "review.lamp_gap"],
    }),
    anomaly({
      id: "core.anomaly.third_knock.v1",
      tags: ["anomaly", "threshold", "guest"],
      ruleComponents: ["threshold_invitation", "town_rule_known_response"],
      affectedSystems: ["door", "town_rule", "obligation", "faction"],
      evidenceClasses: ["knock_count", "threshold_mark", "witness", "lodging_register"],
      stateMachine: ["dormant", "first_knock", "third_knock", "debt_bound", "resolved"],
      commonMisread: "The third sound is treated as weather instead of an invitation rule.",
      accidentReviewKeys: ["review.third_knock.threshold", "review.guesthouse_policy"],
    }),
    anomaly({
      id: "core.anomaly.old_bridge_guest.v1",
      tags: ["anomaly", "bridge", "logistics"],
      ruleComponents: ["prepared_item_passage", "route_obligation_evidence"],
      affectedSystems: ["route", "storage", "trade", "obligation"],
      evidenceClasses: ["bridge_ledger", "prepared_bundle", "merchant_testimony", "route_delay"],
      stateMachine: ["dormant", "month_end_crossing", "item_checked", "passage_resolved"],
      commonMisread: "The crossing is mistaken for a toll instead of reciprocal preparation.",
      accidentReviewKeys: ["review.old_bridge.route", "review.prepared_item"],
    }),
    factionHook({
      id: "core.faction_hook.nine_inns_guest_network.v1",
      tags: ["faction", "guesthouse", "trade"],
      factLanes: ["trade", "debt", "guest_network"],
      sourceFacts: ["lamp_oil_supply", "lodging_register", "bridge_route_delay"],
      policyContexts: ["guesthouse_policy", "market_contract_terms"],
    }),
    factionHook({
      id: "core.faction_hook.mountain_contract_guides.v1",
      tags: ["faction", "guide", "old_debt"],
      factLanes: ["local_knowledge", "debt", "route_safety"],
      sourceFacts: ["guide_roster", "prepared_goods", "oral_history"],
      policyContexts: ["route_access", "herb_gathering_right"],
    }),
    governanceHook({
      id: "core.governance_hook.lampkeeper_patrol_policy.v1",
      tags: ["governance", "lampkeeper", "patrol"],
      postId: "town.post.lampkeeper",
      authorities: ["temporary_lamp_policy", "night_patrol_assignment"],
      legitimacySources: ["town_council", "lamp_oil_accounting"],
      enforcementCosts: ["lamp_oil", "watch_time"],
    }),
    governanceHook({
      id: "core.governance_hook.chronicler_evidence_seal.v1",
      tags: ["governance", "chronicler", "evidence"],
      postId: "town.post.chronicler",
      authorities: ["evidence_seal", "source_note_request"],
      legitimacySources: ["chronicle_record", "council_review"],
      enforcementCosts: ["paper", "scribe_time"],
    }),
    seasonEvent({
      id: "core.season_event.resource_pressure.v1",
      tags: ["season", "resource", "lamp_oil"],
      references: ["core.faction_hook.nine_inns_guest_network.v1"],
      theme: "resource_pressure",
      pressureCategory: "resource",
      legalPreconditions: ["lamp_oil_inventory_known", "work_offer_available"],
      warningSigns: ["oil_press_queue", "watch_lantern_dim"],
      cooldownTicks: 1800,
      recoveryType: "resource_recovery",
      outcomes: ["resource_opportunity"],
    }),
    seasonEvent({
      id: "core.season_event.registration_pressure.v1",
      tags: ["season", "registration", "identity"],
      references: ["core.governance_hook.chronicler_evidence_seal.v1"],
      theme: "registration_pressure",
      pressureCategory: "legal_identity",
      legalPreconditions: ["registry_open", "chronicle_basis_available"],
      warningSigns: ["name_queue", "lost_register_page"],
      cooldownTicks: 2400,
      recoveryType: "registration_recovery",
      outcomes: ["registration_opportunity"],
    }),
    seasonEvent({
      id: "core.season_event.bridge_route_pressure.v1",
      tags: ["season", "bridge", "route"],
      references: ["core.anomaly.old_bridge_guest.v1"],
      theme: "bridge_route_pressure",
      pressureCategory: "logistics",
      legalPreconditions: ["route_window_open", "prepared_item_basis_known"],
      warningSigns: ["bridge_ledger_gap", "merchant_delay"],
      cooldownTicks: 3000,
      recoveryType: "bridge_route_recovery",
      outcomes: ["bridge_route_opportunity"],
    }),
    ...CATALOG_ENTRIES.map((entry) => catalogEntry(entry)),
  ];
}

function anomaly(input: {
  readonly id: string;
  readonly tags: readonly string[];
  readonly ruleComponents: readonly string[];
  readonly affectedSystems: readonly string[];
  readonly evidenceClasses: readonly string[];
  readonly stateMachine: readonly string[];
  readonly commonMisread: string;
  readonly accidentReviewKeys: readonly string[];
}): M5AlphaDefinition {
  return baseDefinition(input.id, "m5.anomaly", input.tags, [], {
    ruleComponents: input.ruleComponents,
    affectedSystems: input.affectedSystems,
    evidenceClasses: input.evidenceClasses,
    nonCombatResolutions: ["evidence_review", "policy_containment"],
    stateMachine: input.stateMachine,
    commonMisread: input.commonMisread,
    accidentReviewKeys: input.accidentReviewKeys,
  });
}

function factionHook(input: {
  readonly id: string;
  readonly tags: readonly string[];
  readonly factLanes: readonly string[];
  readonly sourceFacts: readonly string[];
  readonly policyContexts: readonly string[];
}): M5AlphaDefinition {
  return baseDefinition(input.id, "m5.faction_hook", input.tags, [], {
    factLanes: input.factLanes,
    sourceFacts: input.sourceFacts,
    policyContexts: input.policyContexts,
  });
}

function governanceHook(input: {
  readonly id: string;
  readonly tags: readonly string[];
  readonly postId: string;
  readonly authorities: readonly string[];
  readonly legitimacySources: readonly string[];
  readonly enforcementCosts: readonly string[];
}): M5AlphaDefinition {
  return baseDefinition(input.id, "m5.governance_hook", input.tags, [], {
    postId: input.postId,
    authorities: input.authorities,
    legitimacySources: input.legitimacySources,
    enforcementCosts: input.enforcementCosts,
  });
}

function seasonEvent(input: {
  readonly id: string;
  readonly tags: readonly string[];
  readonly references: readonly string[];
  readonly theme: string;
  readonly pressureCategory: string;
  readonly legalPreconditions: readonly string[];
  readonly warningSigns: readonly string[];
  readonly cooldownTicks: number;
  readonly recoveryType: string;
  readonly outcomes: readonly string[];
}): M5AlphaDefinition {
  return baseDefinition(input.id, "m5.season_event", input.tags, input.references, {
    theme: input.theme,
    pressureCategory: input.pressureCategory,
    legalPreconditions: input.legalPreconditions,
    warningSigns: input.warningSigns,
    cooldownTicks: input.cooldownTicks,
    recoveryType: input.recoveryType,
    outcomes: input.outcomes,
  });
}

function catalogEntry(input: CatalogEntryInput): M5AlphaDefinition {
  return baseDefinition(input.id, "m5.catalog_entry", input.tags, input.references, {
    catalogKind: input.catalogKind,
    ownerSurfaces: input.ownerSurfaces,
    systemValue: input.systemValue,
    reusableTags: input.reusableTags,
    reviewNeeds: {
      systemValueAlternatives: input.alternatives,
      factionGovernanceAnomalyHooks: input.hooks,
      cultureFairnessReview: input.cultureFairnessReview,
      ...(input.blockedReason === undefined ? {} : { blockedReason: input.blockedReason }),
    },
  });
}

function baseDefinition(
  id: string,
  kind: string,
  tags: readonly string[],
  references: readonly string[],
  extra: Readonly<Record<string, unknown>>,
): M5AlphaDefinition {
  return {
    schemaVersion: 1,
    id,
    kind,
    labelKey: `content.${id}.label`,
    descriptionKey: `content.${id}.description`,
    tags,
    references,
    sourceNotes: [`WM-0079 alpha catalog fixture for ${id}.`],
    contentBudget: {
      bespokeRuntimeComponents: 0,
      uniqueArtAssets: 0,
    },
    ...extra,
  };
}

function createPack(
  definitions: readonly M5AlphaDefinition[],
  localePatch: Readonly<Record<string, string | undefined>> | undefined,
  extraFiles: readonly M5ContentPackFile[],
): M5ContentPack {
  const locales = buildLocaleEntries(definitions, localePatch);
  return {
    rootDir: "coordination/artifacts/WM-0079/accepted-alpha-pack",
    files: [
      file("manifest.json", {
        schemaVersion: 1,
        id: "core.m5.alpha_catalog.v1",
        version: "0.0.1",
        displayName: "M5 Alpha Catalog",
        capabilities: ["content:m5-alpha", "data:def", "data:locale"],
        contentKinds: [
          "m5.anomaly",
          "m5.faction_hook",
          "m5.governance_hook",
          "m5.season_event",
          "m5.catalog_entry",
        ],
        locales: ["en", "zh"],
        dependencies: [],
        maxFileBytes: 65536,
        maxTotalBytes: 524288,
      }),
      ...definitions.map((definition) => file(`defs/${definition.id}.json`, definition)),
      file("locales/en.json", locales.en),
      file("locales/zh.json", locales.zh),
      ...extraFiles,
    ],
  };
}

function patchDefinitions(
  definitions: readonly M5AlphaDefinition[],
  patch: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): readonly M5AlphaDefinition[] {
  return definitions.map((definition) => ({
    ...definition,
    ...(patch[definition.id] ?? {}),
  }));
}

function rejectedDefinitionPatch(
  kind: M5AlphaRejectedFixtureKind,
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  if (kind === "building-owner-surface") {
    return {
      "core.catalog.hearth_lantern.v1": {
        ownerSurfaces: [],
      },
    };
  }
  if (kind === "tag-owner-surface") {
    return {
      "core.catalog.bridge_route_marker.v1": {
        ownerSurfaces: [],
      },
    };
  }
  if (kind === "anomaly-evidence") {
    return {
      "core.anomaly.old_bridge_guest.v1": {
        evidenceClasses: ["ledger"],
      },
    };
  }
  if (kind === "faction-hook-lanes") {
    return {
      "core.faction_hook.nine_inns_guest_network.v1": {
        factLanes: ["trade"],
      },
    };
  }
  if (kind === "season-event-cooldown") {
    return {
      "core.season_event.registration_pressure.v1": {
        cooldownTicks: 0,
      },
    };
  }
  return {};
}

function buildLocaleEntries(
  definitions: readonly M5AlphaDefinition[],
  localePatch: Readonly<Record<string, string | undefined>> | undefined,
): Readonly<Record<"en" | "zh", Readonly<Record<string, string>>>> {
  const en: Record<string, string> = {};
  const zh: Record<string, string> = {};
  for (const definition of definitions) {
    en[definition.labelKey] = `Label ${definition.id}`;
    en[definition.descriptionKey] = `Description ${definition.id}`;
    zh[definition.labelKey] = `ZH label ${definition.id}`;
    zh[definition.descriptionKey] = `ZH description ${definition.id}`;
  }
  if (localePatch !== undefined) {
    for (const [key, value] of Object.entries(localePatch)) {
      if (value === undefined) {
        Reflect.deleteProperty(en, key);
        Reflect.deleteProperty(zh, key);
      } else {
        en[key] = value;
        zh[key] = value;
      }
    }
  }
  return { en, zh };
}

function file(relativePath: string, value: unknown): M5ContentPackFile {
  const text = `${JSON.stringify(value, undefined, 2)}\n`;
  return {
    relativePath,
    text,
    byteLength: Buffer.byteLength(text, "utf8"),
  };
}

const CATALOG_ENTRIES: readonly CatalogEntryInput[] = [
  {
    id: "core.catalog.hearth_lantern.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "lamp", "home"],
    references: ["core.anomaly.borrowed_shadow.v1"],
    ownerSurfaces: ["M4LampNetworkStore", "M4EvidenceFactStore"],
    systemValue: ["room_identity_safety", "lamp_gap_visibility"],
    reusableTags: ["lamp", "home", "identity_boundary"],
    alternatives: ["road_lantern", "watch_lantern"],
    hooks: ["borrowed_shadow", "lampkeeper_patrol_policy"],
    cultureFairnessReview:
      "Avoids treating household custom as superstition; records practical lamp use.",
  },
  {
    id: "core.catalog.road_lantern.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "lamp", "road"],
    references: ["core.governance_hook.lampkeeper_patrol_policy.v1"],
    ownerSurfaces: ["M4LampNetworkStore", "WorkOfferIndex"],
    systemValue: ["night_route_safety", "patrol_visibility"],
    reusableTags: ["lamp", "road", "patrol"],
    alternatives: ["hearth_lantern", "watch_lantern"],
    hooks: ["resource_pressure", "lampkeeper_patrol_policy"],
    cultureFairnessReview:
      "Frames roads as logistics and safety infrastructure, not exotic atmosphere.",
  },
  {
    id: "core.catalog.watch_lantern.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "lamp", "watch"],
    references: ["core.season_event.resource_pressure.v1"],
    ownerSurfaces: ["M4LampNetworkStore", "WorkOfferIndex"],
    systemValue: ["watch_post_visibility", "oil_demand_pressure"],
    reusableTags: ["lamp", "watch", "resource_pressure"],
    alternatives: ["road_lantern", "night_watch_post"],
    hooks: ["resource_pressure", "nine_inns_guest_network"],
    cultureFairnessReview:
      "Connects safety labor to resource costs instead of heroic night policing.",
  },
  {
    id: "core.catalog.oil_press.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "resource", "oil"],
    references: ["core.season_event.resource_pressure.v1"],
    ownerSurfaces: ["ItemStackStore", "WorkOfferIndex", "StorageLogisticsIndex"],
    systemValue: ["lamp_oil_supply", "labor_queue_pressure"],
    reusableTags: ["resource", "oil", "work_offer"],
    alternatives: ["herb_drying_rack", "prepared_bundle_shelf"],
    hooks: ["resource_pressure", "nine_inns_guest_network"],
    cultureFairnessReview:
      "Treats oil as material production with labor costs, not a mystical cure-all.",
  },
  {
    id: "core.catalog.chronicle_room.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "chronicle", "evidence"],
    references: ["core.governance_hook.chronicler_evidence_seal.v1"],
    ownerSurfaces: ["M4ChronicleCaseFileStore", "M4EvidenceFactStore"],
    systemValue: ["evidence_retention", "source_note_review"],
    reusableTags: ["chronicle", "evidence", "paper"],
    alternatives: ["patrol_registry_desk", "council_notice_post"],
    hooks: ["registration_pressure", "chronicler_evidence_seal"],
    cultureFairnessReview: "Requires source notes and separates observation from inference.",
  },
  {
    id: "core.catalog.guest_house.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "guest", "lodging"],
    references: ["core.faction_hook.nine_inns_guest_network.v1"],
    ownerSurfaces: ["M4ObligationStore", "WorkOfferIndex", "M5FactionFactStore"],
    systemValue: ["guest_isolation", "lodging_obligation_pressure"],
    reusableTags: ["guest", "lodging", "debt"],
    alternatives: ["lodging_register", "threshold_mark_kit"],
    hooks: ["third_knock", "nine_inns_guest_network"],
    cultureFairnessReview:
      "Guest handling is policy and obligation work, not blanket outsider fear.",
  },
  {
    id: "core.catalog.night_watch_post.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "watch", "job"],
    references: ["core.governance_hook.lampkeeper_patrol_policy.v1"],
    ownerSurfaces: ["WorkOfferIndex", "JobCoreStore", "M4TownRuleStore"],
    systemValue: ["patrol_assignment", "rule_enforcement_cost"],
    reusableTags: ["watch", "job", "policy"],
    alternatives: ["watch_lantern", "council_notice_post"],
    hooks: ["lampkeeper_patrol_policy", "registration_pressure"],
    cultureFairnessReview: "Documents who bears enforcement cost and who benefits.",
  },
  {
    id: "core.catalog.bridge_ledger_table.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "bridge", "ledger"],
    references: ["core.anomaly.old_bridge_guest.v1"],
    ownerSurfaces: ["M4ChronicleCaseFileStore", "M4ObligationStore"],
    systemValue: ["bridge_evidence", "route_delay_trace"],
    reusableTags: ["bridge", "ledger", "evidence"],
    alternatives: ["bridge_route_marker", "prepared_bundle_shelf"],
    hooks: ["old_bridge_guest", "bridge_route_pressure"],
    cultureFairnessReview: "Records trade obligations as accountable logistics evidence.",
  },
  {
    id: "core.catalog.return_lamp_shelf.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "memory", "lamp"],
    references: ["core.anomaly.borrowed_shadow.v1"],
    ownerSurfaces: ["M4ChronicleCaseFileStore", "M4LampNetworkStore"],
    systemValue: ["name_preservation", "identity_evidence"],
    reusableTags: ["memory", "lamp", "identity"],
    alternatives: ["chronicle_room", "hearth_lantern"],
    hooks: ["borrowed_shadow", "chronicler_evidence_seal"],
    cultureFairnessReview:
      "Avoids using mourning practices as horror texture; stores consented records.",
  },
  {
    id: "core.catalog.herb_drying_rack.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "resource", "medicine"],
    references: ["core.faction_hook.mountain_contract_guides.v1"],
    ownerSurfaces: ["ItemStackStore", "WorkOfferIndex"],
    systemValue: ["medicine_supply", "guide_trade_pressure"],
    reusableTags: ["herb", "medicine", "work_offer"],
    alternatives: ["oil_press", "storage_crate_tag"],
    hooks: ["mountain_contract_guides", "resource_pressure"],
    cultureFairnessReview:
      "Connects local knowledge to consented guide labor and material sourcing.",
  },
  {
    id: "core.catalog.patrol_registry_desk.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "registry", "legal_identity"],
    references: ["core.season_event.registration_pressure.v1"],
    ownerSurfaces: ["M4TownRuleStore", "M4ChronicleCaseFileStore", "M5GovernanceHookStore"],
    systemValue: ["legal_identity_review", "registration_queue"],
    reusableTags: ["registry", "identity", "law"],
    alternatives: ["chronicle_room", "council_notice_post"],
    hooks: ["registration_pressure", "chronicler_evidence_seal"],
    cultureFairnessReview: "Names censorship risk and legal aid tradeoffs in review notes.",
  },
  {
    id: "core.catalog.threshold_mark_kit.v1",
    catalogKind: "item",
    tags: ["catalog", "item", "threshold", "evidence"],
    references: ["core.anomaly.third_knock.v1"],
    ownerSurfaces: ["ItemStackStore", "M4TownRuleStore", "M4ChronicleCaseFileStore"],
    systemValue: ["threshold_trace", "invitation_rule_evidence"],
    reusableTags: ["threshold", "evidence", "door"],
    alternatives: ["lodging_register", "patrol_registry_desk"],
    hooks: ["third_knock", "registration_pressure"],
    cultureFairnessReview:
      "Treats threshold markings as evidence practice, not a sacred ritual copy.",
  },
  {
    id: "core.catalog.prepared_bundle_shelf.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "storage", "prepared_item"],
    references: ["core.anomaly.old_bridge_guest.v1"],
    ownerSurfaces: ["ItemStackStore", "StorageLogisticsIndex", "M4ObligationStore"],
    systemValue: ["prepared_item_basis", "route_obligation_buffer"],
    reusableTags: ["storage", "prepared_item", "obligation"],
    alternatives: ["bridge_ledger_table", "oil_press"],
    hooks: ["old_bridge_guest", "bridge_route_pressure"],
    cultureFairnessReview: "Makes reciprocal aid explicit and rejects self-serving toll framing.",
  },
  {
    id: "core.catalog.lamp_oil_token.v1",
    catalogKind: "tag",
    tags: ["catalog", "tag", "resource", "lamp_oil"],
    references: ["core.season_event.resource_pressure.v1"],
    ownerSurfaces: ["ItemStackStore"],
    systemValue: ["resource_accounting", "lamp_oil_budget"],
    reusableTags: ["resource", "lamp_oil", "token"],
    alternatives: ["storage_crate_tag", "watch_lantern"],
    hooks: ["resource_pressure", "nine_inns_guest_network"],
    cultureFairnessReview: "Uses accounting language instead of ritual scarcity framing.",
  },
  {
    id: "core.catalog.lodging_register.v1",
    catalogKind: "tag",
    tags: ["catalog", "tag", "guest", "record"],
    references: ["core.anomaly.third_knock.v1"],
    ownerSurfaces: ["M4ChronicleCaseFileStore", "M5FactionFactStore"],
    systemValue: ["guest_identity_reference", "lodging_debt_trace"],
    reusableTags: ["guest", "record", "identity"],
    alternatives: ["guest_house", "patrol_registry_desk"],
    hooks: ["third_knock", "nine_inns_guest_network"],
    cultureFairnessReview: "Separates visitor records from suspicion against outsiders.",
  },
  {
    id: "core.catalog.bridge_route_marker.v1",
    catalogKind: "tag",
    tags: ["catalog", "tag", "bridge", "route"],
    references: ["core.season_event.bridge_route_pressure.v1"],
    ownerSurfaces: ["M5OldBridgeGuestCrisisStore", "M5SeasonEventPoolStore"],
    systemValue: ["route_scope", "bridge_event_precondition"],
    reusableTags: ["bridge", "route", "season_event"],
    alternatives: ["bridge_ledger_table", "prepared_bundle_shelf"],
    hooks: ["old_bridge_guest", "bridge_route_pressure"],
    cultureFairnessReview: "Defines route pressure as logistics evidence, not inherited blame.",
  },
  {
    id: "core.catalog.oral_history_stool.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "oral_history", "evidence"],
    references: ["core.faction_hook.mountain_contract_guides.v1"],
    ownerSurfaces: ["M4ChronicleCaseFileStore", "M5FactionFactStore"],
    systemValue: ["oral_history_source_note", "guide_relation_memory"],
    reusableTags: ["oral_history", "source_note", "faction"],
    alternatives: ["chronicle_room", "bridge_ledger_table"],
    hooks: ["mountain_contract_guides", "chronicler_evidence_seal"],
    cultureFairnessReview: "Marks oral record reliability and adaptation boundaries.",
  },
  {
    id: "core.catalog.archive_fire_bucket.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "archive", "safety"],
    references: ["core.governance_hook.chronicler_evidence_seal.v1"],
    ownerSurfaces: ["M4ChronicleCaseFileStore", "WorkOfferIndex"],
    systemValue: ["archive_damage_mitigation", "emergency_work_offer"],
    reusableTags: ["archive", "safety", "water"],
    alternatives: ["chronicle_room", "night_watch_post"],
    hooks: ["chronicler_evidence_seal", "resource_pressure"],
    cultureFairnessReview: "Frames archive risk as ordinary safety maintenance.",
  },
  {
    id: "core.catalog.market_contract_board.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "market", "contract"],
    references: ["core.faction_hook.nine_inns_guest_network.v1"],
    ownerSurfaces: ["blocked.owner_surface.future_market_contracts"],
    systemValue: ["contract_offer_preview", "debt_term_visibility"],
    reusableTags: ["market", "contract", "debt"],
    alternatives: ["guest_house", "council_notice_post"],
    hooks: ["nine_inns_guest_network", "registration_pressure"],
    cultureFairnessReview: "Requires future review for debt commercialization and consent clarity.",
    blockedReason:
      "No reviewed market-contract owner surface exists in M5; keep as blocked catalog data.",
  },
  {
    id: "core.catalog.council_notice_post.v1",
    catalogKind: "building",
    tags: ["catalog", "building", "council", "policy"],
    references: ["core.governance_hook.lampkeeper_patrol_policy.v1"],
    ownerSurfaces: ["M4TownRuleStore", "M5GovernanceHookStore"],
    systemValue: ["policy_visibility", "legitimacy_source"],
    reusableTags: ["council", "policy", "notice"],
    alternatives: ["patrol_registry_desk", "night_watch_post"],
    hooks: ["lampkeeper_patrol_policy", "registration_pressure"],
    cultureFairnessReview: "Names who can read and contest notices before enforcement.",
  },
];
