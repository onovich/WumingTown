import { describe, expect, it } from "vitest";

import {
  M5_ALPHA_CATALOG_ENTRY_COUNT,
  M5_ALPHA_DEFINITION_COUNT,
  createM5AlphaContentCatalogPack,
  type M5ContentPack,
} from "@wuming-town/content-schema";

import { compileM5ContentPack } from "./m5-content-compiler";

describe("M5 content compilation", () => {
  it("emits stable DefIndex order, counters and content manifest hash", () => {
    const result = compileM5ContentPack(createValidM5Pack());

    expect(result.ok).toBe(true);
    if (!result.ok || result.catalog === undefined) {
      throw new Error("expected M5 content compilation to succeed");
    }

    expect(result.catalog.definitions.map((definition) => definition.id)).toStrictEqual([
      "core.anomaly.third_knock.v1",
      "core.catalog.road_lantern.v1",
      "core.faction_hook.nine_inns_trade.v1",
      "core.governance_hook.lampkeeper_policy.v1",
      "core.season_event.market_night.v1",
    ]);
    expect(result.catalog.definitions.map((definition) => definition.defIndex)).toStrictEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(result.catalog.contentManifestHash).toMatch(/^0x[0-9a-f]{8}$/);
    expect(result.catalog.counters).toMatchObject({
      definitionCount: 5,
      diagnosticCount: 0,
    });
    expect(Object.isFrozen(result.catalog)).toBe(true);
    expect(Object.isFrozen(result.catalog.definitions)).toBe(true);
  });

  it("keeps the content manifest hash stable when file order changes", () => {
    const pack = createValidM5Pack();
    const reversedPack = {
      rootDir: pack.rootDir,
      files: pack.files.slice().reverse(),
    };
    const first = compileM5ContentPack(pack);
    const second = compileM5ContentPack(reversedPack);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || first.catalog === undefined || !second.ok || second.catalog === undefined) {
      throw new Error("expected both M5 compiles to succeed");
    }

    expect(second.catalog.contentManifestHash).toBe(first.catalog.contentManifestHash);
  });

  it("compiles the WM-0079 alpha catalog fixture with deterministic catalog rows", () => {
    const result = compileM5ContentPack(createM5AlphaContentCatalogPack());

    expect(result.ok).toBe(true);
    if (!result.ok || result.catalog === undefined) {
      throw new Error("expected WM-0079 alpha catalog compilation to succeed");
    }

    expect(result.catalog.definitions).toHaveLength(M5_ALPHA_DEFINITION_COUNT);
    expect(result.catalog.counters).toMatchObject({
      definitionCount: M5_ALPHA_DEFINITION_COUNT,
      catalogEntryCount: M5_ALPHA_CATALOG_ENTRY_COUNT,
      diagnosticCount: 0,
    });
    expect(result.catalog.definitions.map((definition) => definition.defIndex)).toStrictEqual(
      Array.from({ length: M5_ALPHA_DEFINITION_COUNT }, (_, index) => index),
    );
    expect(result.catalog.definitions[0]).toMatchObject({
      defIndex: 0,
      id: "core.anomaly.borrowed_shadow.v1",
    });
    expect(result.catalog.definitions.at(-1)).toMatchObject({
      defIndex: M5_ALPHA_DEFINITION_COUNT - 1,
      id: "core.season_event.resource_pressure.v1",
    });
    expect(
      result.catalog.definitions.some(
        (definition) => definition.id === "core.catalog.market_contract_board.v1",
      ),
    ).toBe(true);
    expect(result.catalog.contentManifestHash).toMatch(/^0x[0-9a-f]{8}$/);
  });
});

function createValidM5Pack(): M5ContentPack {
  const definitions = [
    {
      schemaVersion: 1,
      id: "core.anomaly.third_knock.v1",
      kind: "m5.anomaly",
      labelKey: "content.core.anomaly.third_knock.v1.label",
      descriptionKey: "content.core.anomaly.third_knock.v1.description",
      tags: ["anomaly", "threshold"],
      references: [],
      sourceNotes: ["Third knock M5 validation fixture."],
      contentBudget: zeroBespokeBudget(),
      ruleComponents: ["threshold.invitation"],
      affectedSystems: ["town_rule", "obligation", "chronicle"],
      evidenceClasses: ["testimony", "trace", "source", "observation"],
      nonCombatResolutions: ["containment_policy"],
      stateMachine: ["dormant", "trace", "resolved"],
      commonMisread: "Residents mistake the first knock for the rule trigger.",
      accidentReviewKeys: ["review.third_knock"],
    },
    {
      schemaVersion: 1,
      id: "core.catalog.road_lantern.v1",
      kind: "m5.catalog_entry",
      labelKey: "content.core.catalog.road_lantern.v1.label",
      descriptionKey: "content.core.catalog.road_lantern.v1.description",
      tags: ["catalog", "building", "lamp"],
      references: [],
      sourceNotes: ["Road lantern M5 validation fixture."],
      contentBudget: zeroBespokeBudget(),
      catalogKind: "building",
      ownerSurfaces: ["LampNetworkStore"],
      systemValue: ["night_boundary_safety"],
      reusableTags: ["lamp", "road"],
    },
    {
      schemaVersion: 1,
      id: "core.faction_hook.nine_inns_trade.v1",
      kind: "m5.faction_hook",
      labelKey: "content.core.faction_hook.nine_inns_trade.v1.label",
      descriptionKey: "content.core.faction_hook.nine_inns_trade.v1.description",
      tags: ["faction", "trade"],
      references: [],
      sourceNotes: ["Nine Inns M5 validation fixture."],
      contentBudget: zeroBespokeBudget(),
      factLanes: ["trade", "debt"],
      sourceFacts: ["lamp_oil_supply"],
      policyContexts: ["guesthouse_policy"],
    },
    {
      schemaVersion: 1,
      id: "core.governance_hook.lampkeeper_policy.v1",
      kind: "m5.governance_hook",
      labelKey: "content.core.governance_hook.lampkeeper_policy.v1.label",
      descriptionKey: "content.core.governance_hook.lampkeeper_policy.v1.description",
      tags: ["governance", "lampkeeper"],
      references: [],
      sourceNotes: ["Lampkeeper policy M5 validation fixture."],
      contentBudget: zeroBespokeBudget(),
      postId: "town.post.lampkeeper",
      authorities: ["temporary_lamp_policy"],
      legitimacySources: ["town_council"],
      enforcementCosts: ["lamp_oil"],
    },
    {
      schemaVersion: 1,
      id: "core.season_event.market_night.v1",
      kind: "m5.season_event",
      labelKey: "content.core.season_event.market_night.v1.label",
      descriptionKey: "content.core.season_event.market_night.v1.description",
      tags: ["season", "night_market"],
      references: [],
      sourceNotes: ["Market night M5 validation fixture."],
      contentBudget: zeroBespokeBudget(),
      theme: "night_market",
      pressureCategory: "opportunity",
      legalPreconditions: ["known_guest_rules"],
      warningSigns: ["market_lanterns_dim"],
      cooldownTicks: 3600,
      recoveryType: "trade_recovery",
      outcomes: ["contract_offer"],
    },
  ];
  const locale = buildLocaleEntries(definitions);

  return {
    rootDir: "m5-pack",
    files: [
      file("manifest.json", {
        schemaVersion: 1,
        id: "core.m5.alpha_pack.v1",
        version: "0.0.1",
        displayName: "M5 Alpha Pack",
        capabilities: ["content:m5-alpha", "data:def", "data:locale", "data:patch"],
        contentKinds: [
          "m5.season_event",
          "m5.governance_hook",
          "m5.catalog_entry",
          "m5.faction_hook",
          "m5.anomaly",
        ],
        locales: ["en", "zh"],
        dependencies: [],
        maxFileBytes: 65536,
        maxTotalBytes: 524288,
      }),
      ...definitions.map((definition) => file(`defs/${definition.id}.json`, definition)),
      file("locales/en.json", locale.en),
      file("locales/zh.json", locale.zh),
    ],
  };
}

function zeroBespokeBudget(): Readonly<Record<string, number>> {
  return {
    bespokeRuntimeComponents: 0,
    uniqueArtAssets: 0,
  };
}

function buildLocaleEntries(
  definitions: readonly Readonly<Record<string, unknown>>[],
): Readonly<Record<"en" | "zh", Readonly<Record<string, string>>>> {
  const en: Record<string, string> = {};
  const zh: Record<string, string> = {};
  for (const definition of definitions) {
    const id = definition["id"];
    const labelKey = definition["labelKey"];
    const descriptionKey = definition["descriptionKey"];
    if (
      typeof id === "string" &&
      typeof labelKey === "string" &&
      typeof descriptionKey === "string"
    ) {
      en[labelKey] = `Label ${id}`;
      en[descriptionKey] = `Description ${id}`;
      zh[labelKey] = `名称 ${id}`;
      zh[descriptionKey] = `说明 ${id}`;
    }
  }
  return { en, zh };
}

function file(relativePath: string, value: unknown): M5ContentPack["files"][number] {
  const text = `${JSON.stringify(value, undefined, 2)}\n`;
  return {
    relativePath,
    text,
    byteLength: Buffer.byteLength(text, "utf8"),
  };
}
