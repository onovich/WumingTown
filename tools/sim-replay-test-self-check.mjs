#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import * as path from "node:path";

import { runReplayDiagnostics } from "./sim-replay-diagnostics-lib.mjs";

const rootDir = mkdtempSync(path.join(os.tmpdir(), "wm0010-replay-self-check-"));

try {
  assertStructuredFailure(
    runReplayDiagnostics({
      artifactRoot: path.join(rootDir, "build-failure"),
      buildReplay: () => {
        throw new Error("simulated build failure");
      },
    }),
    "build failure should produce structured diagnostics",
  );

  assertStructuredFailure(
    runReplayDiagnostics({
      artifactRoot: path.join(rootDir, "probe-failure"),
      cloneCheckpoints: () => [],
    }),
    "probe failure should produce structured diagnostics",
  );

  console.log("Replay diagnostics self-check passed.");
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}

function assertStructuredFailure(result, label) {
  if (result.ok) {
    throw new Error(`${label}: expected failure result`);
  }

  if (result.seed !== "WM-0010-long-run") {
    throw new Error(`${label}: missing deterministic seed`);
  }

  if (result.firstDivergentTick !== null) {
    throw new Error(`${label}: expected null first divergent tick for setup failure`);
  }

  if (
    typeof result.artifactPaths.expected !== "string" ||
    typeof result.artifactPaths.actual !== "string" ||
    typeof result.artifactPaths.perturbed !== "string" ||
    typeof result.artifactPaths.summary !== "string"
  ) {
    throw new Error(`${label}: missing structured artifact paths`);
  }
}
