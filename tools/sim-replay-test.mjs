#!/usr/bin/env node
import {
  printReplayDiagnosticsResult,
  runReplayDiagnostics,
} from "./sim-replay-diagnostics-lib.mjs";

const result = runReplayDiagnostics();
printReplayDiagnosticsResult(result);

process.exitCode = result.ok ? 0 : 1;
