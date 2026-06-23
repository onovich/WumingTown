import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { loadContentFixture, validateContentFixture } from "./content-fixtures";

describe("content fixture validation", () => {
  it("reports invalid ids, duplicate ids, missing references, and localization keys with source locations", async () => {
    const fixtureRoot = await createFixtureRoot();
    const fixture = await loadContentFixture(fixtureRoot);
    const result = validateContentFixture(fixture);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected validation failure");
    }

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("invalid_def_id");
    expect(codes).toContain("duplicate_def_id");
    expect(codes).toContain("missing_def_reference");
    expect(codes).toContain("missing_localization_key");

    const invalidId = result.diagnostics.find((diagnostic) => diagnostic.code === "invalid_def_id");
    expect(invalidId?.location.filePath).toContain(path.join("defs", "invalid-id.json"));

    const missingRef = result.diagnostics.find(
      (diagnostic) => diagnostic.code === "missing_def_reference",
    );
    expect(missingRef?.location.filePath).toContain(path.join("defs", "missing-ref.json"));
    expect(missingRef?.location.line).toBe(11);
    expect(missingRef?.location.column).toBe(6);
  });

  it("reports quoted-json field locations instead of 1:1 fallbacks", async () => {
    const fixtureRoot = await createFixtureRoot();
    const fixture = await loadContentFixture(fixtureRoot);
    const result = validateContentFixture(fixture);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected validation failure");
    }

    const invalidId = result.diagnostics.find((diagnostic) => diagnostic.code === "invalid_def_id");
    expect(invalidId?.location.filePath).toContain(path.join("defs", "invalid-id.json"));
    expect(invalidId?.location.line).toBe(3);
    expect(invalidId?.location.column).toBe(9);
  });
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "wuming-content-schema-"));
  await mkdir(path.join(root, "defs"), { recursive: true });
  await mkdir(path.join(root, "locales"), { recursive: true });
  await mkdir(path.join(root, "patches"), { recursive: true });

  await writeJson(path.join(root, "defs", "invalid-id.json"), {
    schemaVersion: 1,
    id: "core.bad",
    kind: "anomaly",
    labelKey: "content.core.anomaly.invalid.label",
    descriptionKey: "content.core.anomaly.invalid.description",
    tags: ["anomaly"],
    references: ["core.anomaly.duplicate"],
    sourceNotes: ["Invalid id test"],
  });
  await writeJson(path.join(root, "defs", "duplicate-a.json"), {
    schemaVersion: 1,
    id: "core.anomaly.duplicate",
    kind: "anomaly",
    labelKey: "content.core.anomaly.duplicate.label",
    descriptionKey: "content.core.anomaly.duplicate.description",
    tags: ["anomaly"],
    references: [],
    sourceNotes: ["Duplicate A"],
  });
  await writeJson(path.join(root, "defs", "duplicate-b.json"), {
    schemaVersion: 1,
    id: "core.anomaly.duplicate",
    kind: "anomaly",
    labelKey: "content.core.anomaly.duplicate.label",
    descriptionKey: "content.core.anomaly.duplicate.description",
    tags: ["anomaly"],
    references: [],
    sourceNotes: ["Duplicate B"],
  });
  await writeJson(path.join(root, "defs", "missing-ref.json"), {
    schemaVersion: 1,
    id: "core.incident.missing_ref",
    kind: "incident",
    labelKey: "content.core.incident.missing_ref.label",
    descriptionKey: "content.core.incident.missing_ref.description",
    tags: ["incident"],
    references: ["core.anomaly.missing"],
    sourceNotes: ["Missing ref test"],
  });
  await writeJson(path.join(root, "locales", "en.json"), {
    "content.core.anomaly.duplicate.label": "Duplicate",
    "content.core.anomaly.duplicate.description": "Duplicate description",
    "content.core.incident.missing_ref.label": "Missing ref",
  });
  await writeJson(path.join(root, "locales", "zh.json"), {
    "content.core.anomaly.duplicate.label": "重复",
    "content.core.anomaly.duplicate.description": "重复说明",
    "content.core.incident.missing_ref.label": "缺少引用",
  });

  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`, "utf8");
}
