import { describe, expect, it } from "vitest";

import { defineWorkspaceSmoke } from "./index";

describe("defineWorkspaceSmoke", () => {
  it("marks workspace public APIs as skeleton-only smoke surfaces", () => {
    expect(defineWorkspaceSmoke("@wuming-town/foundation", "package")).toStrictEqual({
      kind: "package",
      packageName: "@wuming-town/foundation",
      readiness: "skeleton",
    });
  });
});
