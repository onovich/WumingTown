import { describe, expect, it } from "vitest";

import { parseHeadlessCliOptions, runHeadlessCli } from "./index";

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

  it("runs the WM-0150 playable command slice through the CLI", () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const exitCode = runHeadlessCli(
      ["--seed", "5", "--scenario", "wm0150-playable-command-slice", "--ticks", "240"],
      {
        writeLine(line: string): void {
          lines.push(line);
        },
        writeError(line: string): void {
          errors.push(line);
        },
      },
    );
    const parsed: unknown = JSON.parse(lines[0] ?? "{}");

    expect(exitCode).toBe(0);
    expect(errors).toEqual([]);
    expect(isRecord(parsed) ? parsed["scenarioId"] : undefined).toBe(
      "post-m8.playable_lamp_build_command_slice.v1",
    );
    const invariants = isRecord(parsed) ? parsed["invariants"] : undefined;
    expect(isRecord(invariants) ? invariants["lampJobCompleted"] : undefined).toBe(true);
    expect(isRecord(invariants) ? invariants["simpleBuildCompleted"] : undefined).toBe(true);
  });
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
