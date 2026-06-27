import { describe, expect, it } from "vitest";

import { readDiagnosticsVisibility } from "./shell-locale";

describe("shell-locale", () => {
  it("keeps diagnostics hidden unless the explicit query flag is present", () => {
    expect(readDiagnosticsVisibility("")).toBe(false);
    expect(readDiagnosticsVisibility("?wmDiagnostics=0")).toBe(false);
    expect(readDiagnosticsVisibility("?wmDiagnostics=1")).toBe(true);
  });
});
