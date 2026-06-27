#!/usr/bin/env node
import {
  printReplayDiagnosticsResult,
  runReplayDiagnostics,
} from "./sim-replay-diagnostics-lib.mjs";

const options = parseReplayDiagnosticArgs(process.argv.slice(2));
if (!options.ok) {
  console.error(options.error);
  process.exit(1);
}

const result = runReplayDiagnostics(options.value);
printReplayDiagnosticsResult(result);

process.exitCode = result.ok ? 0 : 1;

function parseReplayDiagnosticArgs(rawArgs) {
  const args = rawArgs.filter((arg) => arg !== "--");
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--scenario") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, error: "Missing value for --scenario." };
      }
      options.scenario = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--scenario=")) {
      options.scenario = arg.slice("--scenario=".length);
      continue;
    }

    if (arg === "--seed") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, error: "Missing value for --seed." };
      }
      options.seed = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--seed=")) {
      options.seed = arg.slice("--seed=".length);
      continue;
    }

    if (arg === "--artifact-root") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, error: "Missing value for --artifact-root." };
      }
      options.artifactRoot = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--artifact-root=")) {
      options.artifactRoot = arg.slice("--artifact-root=".length);
      continue;
    }

    return {
      ok: false,
      error:
        "Unsupported replay diagnostics arguments. Use --scenario m2-work-logistics, --scenario m3-ordinary-life, --scenario m4-core-vertical-slice, --scenario m5-alpha-content-framework, --scenario m8-faction-endgame-owner-arcs, --seed <seed>, or --artifact-root <path>.",
    };
  }

  return { ok: true, value: options };
}
