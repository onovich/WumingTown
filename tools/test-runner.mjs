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

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", ...selection.extraArgs, ...selection.targets],
  {
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

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
      "Unsupported test arguments. Use no arguments, --filter building, --filter content, --filter determinism, --filter entity-store, --filter hauling, --filter jobs, --filter m1-invariants, --filter m1-save-replay, --filter m2-invariants, --filter m2-save-replay, --filter m2-worker-parity, --filter m3-invariants, --filter m3-save-replay, --filter m3-worker-parity, --filter m4-chronicle, --filter m4-crisis, --filter m4-director, --filter m4-lamps, --filter m4-obligations, --filter m4-scenario, --filter map-grid, --filter pathing, --filter region-room, --filter reservations, --filter spatial-index, --filter sim-core, --filter sim-protocol, --filter work-offers, --filter worker-smoke, or --filter web-shell.",
  };
}

function selectVitestTargets(selectedMode, selectedFilter) {
  if (selectedMode === "unit") {
    if (selectedFilter === undefined) {
      return { ok: true, extraArgs: ["--exclude=**/*.e2e.test.ts"], targets: [] };
    }

    if (selectedFilter === "sim-protocol") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-protocol/src/protocol-validation.test.ts"],
      };
    }

    if (selectedFilter === "sim-core") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/runner.test.ts"],
      };
    }

    if (selectedFilter === "determinism") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/determinism.test.ts"],
      };
    }

    if (selectedFilter === "entity-store") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/entity-store.invariants.test.ts"],
      };
    }

    if (selectedFilter === "map-grid") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/map-grid.test.ts"],
      };
    }

    if (selectedFilter === "spatial-index") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/spatial-index.test.ts"],
      };
    }

    if (selectedFilter === "region-room") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/region-room.rebuild.test.ts"],
      };
    }

    if (selectedFilter === "reservations") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/reservation-ledger.test.ts"],
      };
    }

    if (selectedFilter === "pathing") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/pathing.test.ts"],
      };
    }

    if (selectedFilter === "jobs") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/job-core.test.ts"],
      };
    }

    if (selectedFilter === "hauling") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/hauling-jobs.test.ts"],
      };
    }

    if (selectedFilter === "building") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/build-site.test.ts"],
      };
    }

    if (selectedFilter === "m1-save-replay") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m1-save-replay.test.ts"],
      };
    }

    if (selectedFilter === "m2-save-replay") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m2-save-replay.test.ts"],
      };
    }

    if (selectedFilter === "m3-save-replay") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m3-save-replay.test.ts"],
      };
    }

    if (selectedFilter === "m2-worker-parity") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-worker/src/m2-worker-parity.test.ts"],
      };
    }

    if (selectedFilter === "m3-worker-parity") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-worker/src/m3-worker-parity.test.ts"],
      };
    }

    if (selectedFilter === "m1-invariants") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m1-invariants.test.ts"],
      };
    }

    if (selectedFilter === "m2-invariants") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m2-invariants.test.ts"],
      };
    }

    if (selectedFilter === "m3-invariants") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m3-invariants.test.ts"],
      };
    }

    if (selectedFilter === "m4-lamps") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m4-lamps.test.ts"],
      };
    }

    if (selectedFilter === "m4-chronicle") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: [
          "packages/sim-core/src/m4-chronicle.test.ts",
          "packages/sim-core/src/m4-chronicle-atomic.test.ts",
          "packages/sim-core/src/m4-chronicle-bounds.test.ts",
        ],
      };
    }

    if (selectedFilter === "m4-obligations") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: [
          "packages/sim-core/src/m4-obligation-store.test.ts",
          "packages/sim-core/src/m4-town-rule-compliance.test.ts",
          "packages/sim-core/src/m4-town-rule-obligation.test.ts",
        ],
      };
    }

    if (selectedFilter === "m4-crisis") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m4-borrowed-shadow-crisis.test.ts"],
      };
    }

    if (selectedFilter === "m4-director") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m4-director-pressure-store.test.ts"],
      };
    }

    if (selectedFilter === "m4-scenario") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/m4-core-vertical-slice-scenario.test.ts"],
      };
    }

    if (selectedFilter === "work-offers") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: ["packages/sim-core/src/work-offers.test.ts"],
      };
    }

    if (selectedFilter === "content") {
      return {
        ok: true,
        extraArgs: ["--exclude=**/*.e2e.test.ts"],
        targets: [
          "packages/content-schema/src/content-fixtures.test.ts",
          "packages/content-compiler/src/compiler.test.ts",
        ],
      };
    }

    return {
      ok: false,
      error: `Unsupported unit test filter: ${selectedFilter}`,
    };
  }

  if (selectedMode === "e2e") {
    if (selectedFilter === undefined) {
      return {
        ok: true,
        extraArgs: [],
        targets: [
          "packages/sim-worker/src/worker-smoke.e2e.test.ts",
          "apps/web/src/web-shell.e2e.test.ts",
          "apps/desktop-electron/src/desktop-shell.e2e.test.ts",
        ],
      };
    }

    if (selectedFilter === "worker-smoke") {
      return {
        ok: true,
        extraArgs: [],
        targets: ["packages/sim-worker/src/worker-smoke.e2e.test.ts"],
      };
    }

    if (selectedFilter === "web-shell") {
      return {
        ok: true,
        extraArgs: [],
        targets: ["apps/web/src/web-shell.e2e.test.ts"],
      };
    }

    if (selectedFilter === "desktop-shell") {
      return {
        ok: true,
        extraArgs: [],
        targets: ["apps/desktop-electron/src/desktop-shell.e2e.test.ts"],
      };
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
