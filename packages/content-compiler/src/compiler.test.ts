import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { compileContentFixture, compileContentFixtureByName } from "./index";

describe("content compiler", () => {
  it("compiles core smoke fixture with stable ordering and immutable locale bundles", async () => {
    const result = await compileContentFixtureByName("core-smoke");

    expect(result.ok).toBe(true);
    if (!result.ok || result.catalog === undefined) {
      throw new Error("expected core smoke compilation to succeed");
    }

    expect(result.catalog.definitions.map((definition) => definition.id)).toStrictEqual([
      "core.anomaly.borrowed_shadow",
      "core.incident.red_lantern_outage",
    ]);
    expect(result.catalog.definitions[0]?.labelsByLocale["en"]).toBe("Borrowed Shadow");
    expect(result.catalog.definitions[1]?.descriptionsByLocale["zh"]).toBe(
      "灯火区在压力暴涨后突然断电。",
    );
    expect(Object.isFrozen(result.catalog)).toBe(true);
    expect(Object.isFrozen(result.catalog.definitions)).toBe(true);
  });

  it("reports patch conflicts rather than silently accepting them", async () => {
    const fixtureRoot = await createConflictFixtureRoot();
    const result = await compileContentFixture(fixtureRoot);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected compilation failure");
    }

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("patch_conflict");
  });

  it("revalidates references and localization after patches", async () => {
    const fixtureRoot = await createPostPatchInvalidFixtureRoot();
    const result = await compileContentFixture(fixtureRoot);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected compilation failure");
    }

    const diagnostics = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(diagnostics).toContain("missing_def_reference");
    expect(diagnostics).toContain("missing_localization_key");
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.location.filePath.endsWith("patch.json")),
    ).toBe(true);
  });

  it("rejects unknown and wrong-type patch fields", async () => {
    const fixtureRoot = await createInvalidPatchFixtureRoot();
    const result = await compileContentFixture(fixtureRoot);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected compilation failure");
    }

    const diagnostics = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(diagnostics).toContain("unknown_patch_change");
    expect(diagnostics).toContain("invalid_patch_change_type");
  });

  it("loads json5 content with comments and trailing commas", async () => {
    const fixtureRoot = await createJson5FixtureRoot();
    const result = await compileContentFixture(fixtureRoot);

    expect(result.ok).toBe(true);
    if (!result.ok || result.catalog === undefined) {
      throw new Error("expected json5 fixture compilation to succeed");
    }

    expect(result.catalog.definitions.map((definition) => definition.id)).toStrictEqual([
      "core.anomaly.json5_sample",
    ]);
  });
});

async function createConflictFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "wuming-content-compiler-"));
  await mkdir(path.join(root, "defs"), { recursive: true });
  await mkdir(path.join(root, "locales"), { recursive: true });
  await mkdir(path.join(root, "patches"), { recursive: true });

  await writeJson(path.join(root, "defs", "sample.json"), {
    schemaVersion: 1,
    id: "core.anomaly.conflict",
    kind: "anomaly",
    labelKey: "content.core.anomaly.conflict.label",
    descriptionKey: "content.core.anomaly.conflict.description",
    tags: ["anomaly"],
    references: [],
    sourceNotes: ["Conflict test"],
  });
  await writeJson(path.join(root, "locales", "en.json"), {
    "content.core.anomaly.conflict.label": "Conflict",
    "content.core.anomaly.conflict.description": "Conflict description",
  });
  await writeJson(path.join(root, "locales", "zh.json"), {
    "content.core.anomaly.conflict.label": "冲突",
    "content.core.anomaly.conflict.description": "冲突说明",
  });
  await writeJson(path.join(root, "patches", "patch-a.json"), {
    targetId: "core.anomaly.conflict",
    changes: {
      tags: ["anomaly", "one"],
    },
  });
  await writeJson(path.join(root, "patches", "patch-b.json"), {
    targetId: "core.anomaly.conflict",
    changes: {
      tags: ["anomaly", "two"],
    },
  });

  return root;
}

async function createPostPatchInvalidFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "wuming-content-post-patch-"));
  await mkdir(path.join(root, "defs"), { recursive: true });
  await mkdir(path.join(root, "locales"), { recursive: true });
  await mkdir(path.join(root, "patches"), { recursive: true });

  await writeJson(path.join(root, "defs", "sample.json"), {
    schemaVersion: 1,
    id: "core.anomaly.post_patch",
    kind: "anomaly",
    labelKey: "content.core.anomaly.post_patch.label",
    descriptionKey: "content.core.anomaly.post_patch.description",
    tags: ["anomaly"],
    references: [],
    sourceNotes: ["Post patch test"],
  });
  await writeJson(path.join(root, "locales", "en.json"), {
    "content.core.anomaly.post_patch.label": "Post Patch",
    "content.core.anomaly.post_patch.description": "Post patch description",
  });
  await writeJson(path.join(root, "locales", "zh.json"), {
    "content.core.anomaly.post_patch.label": "补丁后",
    "content.core.anomaly.post_patch.description": "补丁后说明",
  });
  await writeJson(path.join(root, "patches", "patch.json"), {
    targetId: "core.anomaly.post_patch",
    changes: {
      labelKey: "content.core.anomaly.missing.label",
      references: ["core.anomaly.missing"],
    },
  });

  return root;
}

async function createInvalidPatchFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "wuming-content-invalid-patch-"));
  await mkdir(path.join(root, "defs"), { recursive: true });
  await mkdir(path.join(root, "locales"), { recursive: true });
  await mkdir(path.join(root, "patches"), { recursive: true });

  await writeJson(path.join(root, "defs", "sample.json"), {
    schemaVersion: 1,
    id: "core.anomaly.invalid_patch",
    kind: "anomaly",
    labelKey: "content.core.anomaly.invalid_patch.label",
    descriptionKey: "content.core.anomaly.invalid_patch.description",
    tags: ["anomaly"],
    references: [],
    sourceNotes: ["Invalid patch test"],
  });
  await writeJson(path.join(root, "locales", "en.json"), {
    "content.core.anomaly.invalid_patch.label": "Invalid Patch",
    "content.core.anomaly.invalid_patch.description": "Invalid patch description",
  });
  await writeJson(path.join(root, "locales", "zh.json"), {
    "content.core.anomaly.invalid_patch.label": "无效补丁",
    "content.core.anomaly.invalid_patch.description": "无效补丁说明",
  });
  await writeJson(path.join(root, "patches", "patch.json"), {
    targetId: "core.anomaly.invalid_patch",
    changes: {
      tagz: ["anomaly"],
      tags: [1],
    },
  });

  return root;
}

async function createJson5FixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "wuming-content-json5-"));
  await mkdir(path.join(root, "defs"), { recursive: true });
  await mkdir(path.join(root, "locales"), { recursive: true });
  await mkdir(path.join(root, "patches"), { recursive: true });

  await writeText(
    path.join(root, "defs", "sample.json5"),
    `{
      // Core anomaly smoke fixture
      schemaVersion: 1,
      id: "core.anomaly.json5_sample",
      kind: "anomaly",
      labelKey: "content.core.anomaly.json5_sample.label",
      descriptionKey: "content.core.anomaly.json5_sample.description",
      tags: ["anomaly",],
      references: [],
      sourceNotes: ["JSON5 sample",],
    }\n`,
  );
  await writeText(
    path.join(root, "locales", "en.json5"),
    `{
      "content.core.anomaly.json5_sample.label": "JSON5 Sample",
      "content.core.anomaly.json5_sample.description": "A sample parsed from JSON5.",
    }\n`,
  );
  await writeText(
    path.join(root, "locales", "zh.json5"),
    `{
      "content.core.anomaly.json5_sample.label": "JSON5 示例",
      "content.core.anomaly.json5_sample.description": "来自 JSON5 的示例。",
    }\n`,
  );

  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string): Promise<void> {
  await writeFile(filePath, value, "utf8");
}
