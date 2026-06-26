import { describe, expect, it } from "vitest";

import { mapDirtyInvariantsFromReport, runMapDirtyBenchmark } from "./map-dirty-benchmark";

describe("runMapDirtyBenchmark", () => {
  it("preserves deterministic map-dirty invariants across runs", () => {
    const first = runMapDirtyBenchmark();
    const second = runMapDirtyBenchmark();

    expect(mapDirtyInvariantsFromReport(second)).toStrictEqual(mapDirtyInvariantsFromReport(first));
    expect(first.elapsedMs).toBeGreaterThan(0);
    expect(second.elapsedMs).toBeGreaterThan(0);
  });
});
