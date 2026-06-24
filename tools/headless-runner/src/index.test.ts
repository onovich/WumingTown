import { describe, expect, it } from "vitest";

import { parseHeadlessCliOptions } from "./index";

describe("parseHeadlessCliOptions", () => {
  it("accepts pnpm forwarded arguments after a separator", () => {
    expect(
      parseHeadlessCliOptions([
        "--",
        "--seed",
        "1",
        "--scenario",
        "hauling-building",
        "--ticks",
        "100000",
      ]),
    ).toEqual({
      ok: true,
      options: {
        seed: "1",
        scenario: "hauling-building",
        ticks: 100000,
      },
    });
  });
});
