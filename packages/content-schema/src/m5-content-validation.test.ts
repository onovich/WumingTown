import { describe, expect, it } from "vitest";

import {
  M5_ALPHA_APPROVED_OWNER_SURFACES,
  M5_ALPHA_CATALOG_ENTRY_COUNT,
  M5_ALPHA_DEFINITION_COUNT,
  M5_ALPHA_REJECTED_FIXTURE_KINDS,
  createM5AlphaContentCatalogPack,
  createRejectedM5AlphaContentCatalogPack,
  listM5AlphaCatalogReviewNotes,
  type M5AlphaRejectedFixtureKind,
} from "./m5-alpha-content-catalog-fixtures";
import { type M5ContentPack, validateM5ContentPack } from "./m5-content-validation";

describe("M5 content validation", () => {
  it("accepts a complete data-only M5 alpha content pack", () => {
    const result = validateM5ContentPack(createValidM5Pack());

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(result.counters).toMatchObject({
      definitionCount: 5,
      anomalyCount: 1,
      factionHookCount: 1,
      governanceHookCount: 1,
      seasonEventCount: 1,
      catalogEntryCount: 1,
      diagnosticCount: 0,
    });
    expect(result.pack?.manifest.contentKinds).toStrictEqual([
      "m5.anomaly",
      "m5.catalog_entry",
      "m5.faction_hook",
      "m5.governance_hook",
      "m5.season_event",
    ]);
  });

  it("rejects packs missing required en and zh-CN locale coverage", () => {
    const missingZhCn = createValidM5Pack({
      manifestPatch: {
        locales: ["en"],
      },
    });
    const missingZhCnFile: M5ContentPack = {
      rootDir: missingZhCn.rootDir,
      files: missingZhCn.files.filter(
        (fileEntry) => fileEntry.relativePath !== "locales/zh-CN.json",
      ),
    };

    const missingEn = createValidM5Pack({
      manifestPatch: {
        locales: ["zh-CN"],
      },
    });
    const missingEnFile: M5ContentPack = {
      rootDir: missingEn.rootDir,
      files: missingEn.files.filter((fileEntry) => fileEntry.relativePath !== "locales/en.json"),
    };

    const missingZhCnResult = validateM5ContentPack(missingZhCnFile);
    const missingEnResult = validateM5ContentPack(missingEnFile);

    expect(missingZhCnResult.ok).toBe(false);
    expect(missingEnResult.ok).toBe(false);
    expect(missingZhCnResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "m5_manifest_missing_required_locale",
    );
    expect(missingZhCnResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "m5_manifest_missing_locale_file",
    );
    expect(missingEnResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "m5_manifest_missing_required_locale",
    );
    expect(missingEnResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "m5_manifest_missing_locale_file",
    );
  });

  it("rejects zh.json as a bypass for declared zh-CN coverage", () => {
    const pack = createValidM5Pack({
      manifestPatch: {
        locales: ["en", "zh-CN"],
      },
    });
    const zhCnFile = pack.files.find(
      (fileEntry) => fileEntry.relativePath === "locales/zh-CN.json",
    );
    if (zhCnFile === undefined) {
      throw new Error("expected zh-CN locale file in valid pack");
    }
    const zhBypassPack: M5ContentPack = {
      rootDir: pack.rootDir,
      files: [
        ...pack.files.filter((fileEntry) => fileEntry.relativePath !== "locales/zh-CN.json"),
        {
          ...zhCnFile,
          relativePath: "locales/zh.json",
        },
      ],
    };

    const result = validateM5ContentPack(zhBypassPack);

    expect(result.ok).toBe(false);
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("m5_manifest_missing_locale_file");
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "m5_manifest_missing_locale_file" &&
          diagnostic.message.includes("zh-CN"),
      ),
    ).toBe(true);
  });

  it("accepts the WM-0079 alpha content catalog fixture with review notes", () => {
    const pack = createM5AlphaContentCatalogPack();
    const result = validateM5ContentPack(pack);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(result.counters).toMatchObject({
      definitionCount: M5_ALPHA_DEFINITION_COUNT,
      anomalyCount: 3,
      factionHookCount: 2,
      governanceHookCount: 2,
      seasonEventCount: 3,
      catalogEntryCount: M5_ALPHA_CATALOG_ENTRY_COUNT,
      diagnosticCount: 0,
    });

    const definitions = readDefinitionObjects(pack);
    const catalogEntries = definitions.filter(
      (definition) => definition["kind"] === "m5.catalog_entry",
    );
    expect(catalogEntries).toHaveLength(M5_ALPHA_CATALOG_ENTRY_COUNT);
    const approvedOwnerSurfaces = new Set<string>(M5_ALPHA_APPROVED_OWNER_SURFACES);
    expect(
      catalogEntries.every((definition) =>
        hasApprovedOwnerSurfaceOrExplicitBlock(definition, approvedOwnerSurfaces),
      ),
    ).toBe(true);
    expect(
      catalogEntries.every((definition) => isNonEmptyStringArray(definition["systemValue"])),
    ).toBe(true);
    expect(
      catalogEntries.every((definition) => isNonEmptyStringArray(definition["reusableTags"])),
    ).toBe(true);

    const reviewNotes = listM5AlphaCatalogReviewNotes();
    expect(reviewNotes).toHaveLength(M5_ALPHA_CATALOG_ENTRY_COUNT);
    expect(reviewNotes.every((note) => note.systemValueAlternatives.length > 0)).toBe(true);
    expect(reviewNotes.every((note) => note.factionGovernanceAnomalyHooks.length > 0)).toBe(true);
    expect(reviewNotes.every((note) => note.cultureFairnessReview.length > 0)).toBe(true);
    expect(reviewNotes.some((note) => note.blockedReason !== undefined)).toBe(true);
  });

  it("rejects WM-0079 fixtures for building, tag, anomaly, faction, season, localization and unsafe data", () => {
    const expectedCodes: Readonly<Record<M5AlphaRejectedFixtureKind, readonly string[]>> = {
      "building-owner-surface": ["m5_semantic_field_invalid"],
      "tag-owner-surface": ["m5_semantic_field_invalid"],
      "anomaly-evidence": ["m5_semantic_field_invalid"],
      "faction-hook-lanes": ["m5_semantic_field_invalid"],
      "season-event-cooldown": ["m5_semantic_field_invalid"],
      "missing-localization": ["missing_localization_key"],
      "unsafe-data": ["m5_unsafe_path", "m5_unsupported_capability"],
    };

    for (const fixtureKind of M5_ALPHA_REJECTED_FIXTURE_KINDS) {
      const result = validateM5ContentPack(createRejectedM5AlphaContentCatalogPack(fixtureKind));

      expect(result.ok).toBe(false);
      const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
      for (const expectedCode of expectedCodes[fixtureKind]) {
        expect(codes).toContain(expectedCode);
      }
    }
  });

  it("fails closed for unsafe paths, executable content, archives, remote dependencies and unsupported capabilities", () => {
    const pack = createValidM5Pack({
      manifestPatch: {
        capabilities: ["content:m5-alpha", "code:javascript"],
        contentKinds: ["m5.anomaly", "m5.unknown"],
        dependencies: ["https://example.invalid/mod.json"],
      },
      extraFiles: [
        {
          relativePath: "../escape.json",
          text: "{}",
        },
        {
          relativePath: "scripts/hack.js",
          text: "export const run = () => undefined;",
        },
        {
          relativePath: "archives/payload.zip",
          text: "zip",
        },
        {
          relativePath: "defs/oversized.json",
          text: "{}",
          byteLength: 2,
        },
      ],
    });
    const result = validateM5ContentPack(pack, {
      maxFileBytes: 1,
      maxTotalBytes: 64 * 1024,
    });

    expect(result.ok).toBe(false);
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("m5_unsafe_path");
    expect(codes).toContain("m5_unsupported_capability");
    expect(codes).toContain("m5_archive_file_forbidden");
    expect(codes).toContain("m5_remote_dependency_forbidden");
    expect(codes).toContain("m5_unsupported_content_kind");
    expect(codes).toContain("m5_file_size_exceeded");
  });

  it("enforces manifest-declared per-file size limits against actual pack files", () => {
    const result = validateM5ContentPack(
      createValidM5Pack({
        manifestPatch: {
          maxFileBytes: 1,
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "m5_file_size_exceeded"),
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.message.includes("manifest maximum is 1")),
    ).toBe(true);
  });

  it("enforces manifest-declared total size limits against actual pack bytes", () => {
    const result = validateM5ContentPack(
      createValidM5Pack({
        manifestPatch: {
          maxTotalBytes: 10,
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "m5_total_size_exceeded",
      }),
    );
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes("manifest maximum is 10"),
      ),
    ).toBe(true);
  });

  it("ignores spoofed byteLength metadata when enforcing manifest size limits", () => {
    const honestPack = createValidM5Pack({
      manifestPatch: {
        maxFileBytes: 1,
        maxTotalBytes: 10,
      },
    });
    const spoofedPack: M5ContentPack = {
      rootDir: honestPack.rootDir,
      files: honestPack.files.map((fileEntry) => ({
        ...fileEntry,
        byteLength: 1,
      })),
    };
    const expectedByteCount = spoofedPack.files.reduce(
      (sum, fileEntry) => sum + Buffer.byteLength(fileEntry.text, "utf8"),
      0,
    );

    const result = validateM5ContentPack(spoofedPack);

    expect(result.ok).toBe(false);
    expect(result.counters.byteCount).toBe(expectedByteCount);
    expect(result.counters.byteCount).toBeGreaterThan(spoofedPack.files.length);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "m5_file_size_exceeded",
      }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "m5_total_size_exceeded",
      }),
    );
  });

  it("reports semantic and localization failures before runtime consumption", () => {
    const pack = createValidM5Pack({
      definitionPatch: {
        "core.anomaly.third_knock.v1": {
          evidenceClasses: ["testimony"],
          contentBudget: {
            bespokeRuntimeComponents: 1,
            uniqueArtAssets: 0,
          },
        },
      },
      localePatch: {
        en: {
          "content.core.anomaly.third_knock.v1.description": undefined,
        },
      },
    });
    const result = validateM5ContentPack(pack);

    expect(result.ok).toBe(false);
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("m5_semantic_field_invalid");
    expect(codes).toContain("m5_bespoke_runtime_forbidden");
    expect(codes).toContain("missing_localization_key");
  });

  it("rejects missing references in the M5 content workflow", () => {
    const result = validateM5ContentPack(
      createValidM5Pack({
        definitionPatch: {
          "core.anomaly.third_knock.v1": {
            references: ["core.anomaly.missing"],
          },
        },
      }),
    );

    expect(result.ok).toBe(false);
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("missing_def_reference");
  });
});

interface ValidPackOptions {
  readonly manifestPatch?: Readonly<Record<string, unknown>>;
  readonly definitionPatch?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly localePatch?: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>;
  readonly extraFiles?: readonly M5ContentPack["files"][number][];
}

type M5FixtureDefinition = Readonly<Record<string, unknown>> & {
  readonly id: string;
};

function createValidM5Pack(options: ValidPackOptions = {}): M5ContentPack {
  const manifest = {
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
    locales: ["en", "zh-CN"],
    dependencies: [],
    maxFileBytes: 65536,
    maxTotalBytes: 524288,
    ...options.manifestPatch,
  };
  const definitions = [
    anomalyDefinition(),
    factionHookDefinition(),
    governanceHookDefinition(),
    seasonEventDefinition(),
    catalogEntryDefinition(),
  ].map((definition) => ({
    ...definition,
    ...(options.definitionPatch?.[definition.id] ?? {}),
  }));
  const localeEntries = buildLocaleEntries(definitions, options.localePatch);

  return {
    rootDir: "m5-pack",
    files: [
      file("manifest.json", manifest),
      ...definitions.map((definition) => file(`defs/${definition.id}.json`, definition)),
      file("locales/en.json", localeEntries.en),
      file("locales/zh-CN.json", localeEntries["zh-CN"]),
      ...(options.extraFiles ?? []),
    ],
  };
}

function anomalyDefinition(): M5FixtureDefinition {
  return {
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
  };
}

function factionHookDefinition(): M5FixtureDefinition {
  return {
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
  };
}

function governanceHookDefinition(): M5FixtureDefinition {
  return {
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
  };
}

function seasonEventDefinition(): M5FixtureDefinition {
  return {
    schemaVersion: 1,
    id: "core.season_event.market_night.v1",
    kind: "m5.season_event",
    labelKey: "content.core.season_event.market_night.v1.label",
    descriptionKey: "content.core.season_event.market_night.v1.description",
    tags: ["season", "night_market"],
    references: ["core.faction_hook.nine_inns_trade.v1"],
    sourceNotes: ["Market night M5 validation fixture."],
    contentBudget: zeroBespokeBudget(),
    theme: "night_market",
    pressureCategory: "opportunity",
    legalPreconditions: ["known_guest_rules"],
    warningSigns: ["market_lanterns_dim"],
    cooldownTicks: 3600,
    recoveryType: "trade_recovery",
    outcomes: ["contract_offer"],
  };
}

function catalogEntryDefinition(): M5FixtureDefinition {
  return {
    schemaVersion: 1,
    id: "core.catalog.road_lantern.v1",
    kind: "m5.catalog_entry",
    labelKey: "content.core.catalog.road_lantern.v1.label",
    descriptionKey: "content.core.catalog.road_lantern.v1.description",
    tags: ["catalog", "building", "lamp"],
    references: ["core.governance_hook.lampkeeper_policy.v1"],
    sourceNotes: ["Road lantern M5 validation fixture."],
    contentBudget: zeroBespokeBudget(),
    catalogKind: "building",
    ownerSurfaces: ["LampNetworkStore"],
    systemValue: ["night_boundary_safety"],
    reusableTags: ["lamp", "road"],
  };
}

function zeroBespokeBudget(): Readonly<Record<string, number>> {
  return {
    bespokeRuntimeComponents: 0,
    uniqueArtAssets: 0,
  };
}

function buildLocaleEntries(
  definitions: readonly M5FixtureDefinition[],
  localePatch: ValidPackOptions["localePatch"],
): Readonly<Record<"en" | "zh-CN", Readonly<Record<string, string>>>> {
  const en: Record<string, string> = {};
  const zhCn: Record<string, string> = {};
  for (const definition of definitions) {
    const id = definition.id;
    const labelKey = definition["labelKey"];
    const descriptionKey = definition["descriptionKey"];
    if (
      typeof id === "string" &&
      typeof labelKey === "string" &&
      typeof descriptionKey === "string"
    ) {
      en[labelKey] = `Label ${id}`;
      en[descriptionKey] = `Description ${id}`;
      zhCn[labelKey] = `名称 ${id}`;
      zhCn[descriptionKey] = `说明 ${id}`;
    }
  }

  applyLocalePatch(en, localePatch?.["en"]);
  applyLocalePatch(zhCn, localePatch?.["zh-CN"]);
  return { en, "zh-CN": zhCn };
}

function applyLocalePatch(
  target: Record<string, string>,
  patch: Readonly<Record<string, string | undefined>> | undefined,
): void {
  if (patch === undefined) {
    return;
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      Reflect.deleteProperty(target, key);
    } else {
      target[key] = value;
    }
  }
}

function file(relativePath: string, value: unknown): M5ContentPack["files"][number] {
  const text = `${JSON.stringify(value, undefined, 2)}\n`;
  return {
    relativePath,
    text,
    byteLength: Buffer.byteLength(text, "utf8"),
  };
}

function readDefinitionObjects(pack: M5ContentPack): readonly Readonly<Record<string, unknown>>[] {
  const definitions: Readonly<Record<string, unknown>>[] = [];
  for (const entry of pack.files) {
    if (!entry.relativePath.startsWith("defs/")) {
      continue;
    }
    const parsed: unknown = JSON.parse(entry.text);
    if (isRecord(parsed)) {
      definitions.push(parsed);
    }
  }
  return definitions;
}

function isNonEmptyStringArray(value: unknown): boolean {
  return (
    Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string")
  );
}

function hasApprovedOwnerSurfaceOrExplicitBlock(
  definition: Readonly<Record<string, unknown>>,
  approvedOwnerSurfaces: ReadonlySet<string>,
): boolean {
  const ownerSurfaces = readStringArray(definition["ownerSurfaces"]);
  if (ownerSurfaces === undefined) {
    return false;
  }

  const reviewNeedsValue = definition["reviewNeeds"];
  const blockedReason = isRecord(reviewNeedsValue) ? reviewNeedsValue["blockedReason"] : undefined;
  for (const ownerSurface of ownerSurfaces) {
    if (approvedOwnerSurfaces.has(ownerSurface)) {
      continue;
    }
    if (
      ownerSurface.startsWith("blocked.owner_surface.") &&
      typeof blockedReason === "string" &&
      blockedReason.length > 0
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const strings: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return undefined;
    }
    strings.push(entry);
  }
  return strings;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
