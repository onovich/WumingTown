#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const mode = process.argv[2];
const rawArgs = process.argv.slice(3);

const filter = readFilter(rawArgs);

if (filter.error !== undefined) {
  console.error(filter.error);
  process.exit(1);
}

const selection = selectVitestTargets(mode, filter.value);

if (!selection.ok) {
  console.error(selection.error);
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "vitest", "run", ...selection.targets], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error !== undefined) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function readFilter(args) {
  if (args.length === 0) {
    return { value: undefined };
  }

  if (args.length === 2 && args[0] === "--filter") {
    return { value: args[1] };
  }

  if (args.length === 1 && args[0].startsWith("--filter=")) {
    return { value: args[0].slice("--filter=".length) };
  }

  return {
    error:
      "Unsupported test arguments. Use no arguments, --filter entity-store, --filter sim-core, --filter sim-protocol, or --filter worker-smoke.",
  };
}

function selectVitestTargets(selectedMode, selectedFilter) {
  if (selectedMode === "unit") {
    if (selectedFilter === undefined) {
      return { ok: true, targets: [] };
    }

    if (selectedFilter === "sim-protocol") {
      return { ok: true, targets: ["packages/sim-protocol/src/protocol-validation.test.ts"] };
    }

    if (selectedFilter === "sim-core") {
      return { ok: true, targets: ["packages/sim-core/src/runner.test.ts"] };
    }

    if (selectedFilter === "entity-store") {
      return { ok: true, targets: ["packages/sim-core/src/entity-store.invariants.test.ts"] };
    }

    return {
      ok: false,
      error: `Unsupported unit test filter: ${selectedFilter}`,
    };
  }

  if (selectedMode === "e2e") {
    if (selectedFilter === undefined || selectedFilter === "worker-smoke") {
      return { ok: true, targets: ["packages/sim-worker/src/worker-smoke.e2e.test.ts"] };
    }

    return {
      ok: false,
      error: `Unsupported e2e test filter: ${selectedFilter}`,
    };
  }

  return {
    ok: false,
    error: "Unknown test runner mode. Expected unit or e2e.",
  };
}
