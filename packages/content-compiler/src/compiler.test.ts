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

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`, "utf8");
}
