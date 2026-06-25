# WM-0042 - M2 benchmarks and long-run invariants

## Goal

Add an artifact-backed M2 gate for the 20-actor work/logistics scenario and 100 path requests under versioned invalidation.

## Context Read

- `AGENTS.md`
- `coordination/tasks/WM-0042.json`
- `docs/07_roadmap/07_m2_work_logistics_vertical_slice_plan.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- Existing M1 long-run invariant and benchmark patterns in `packages/sim-core/src/m1-invariants.test.ts` and `packages/benchmarks/src/m1-hauling-building-long-run-benchmark.ts`

## Out Of Scope

- Product behavior fixes to make the gate pass.
- Threshold weakening, silent retries, repeatEach, or broad simulation features.
- UI, Electron, app, package manifest, lockfile, save format, Worker protocol, or M3 work.

## Current Facts And Assumptions

- WM-0041 is done on `origin/main`, so M2 Worker/headless parity exists.
- The M2 scenario already exposes deterministic end-state counters, failure reasons, world hash, and save/replay helpers.
- The required literal commands need existing CLI plumbing: a Vitest filter for `m2-invariants`, an M2 scenario branch in `pnpm sim:run`, and typed benchmark/baseline registry entries. The task packet allowed paths were expanded to name those gate-only files explicitly.

## Approach

- Add `m2-invariants.test.ts` mirroring the M1 long-run gate, using seed `2`, save tick `6000`, final tick `100000`, replay comparison, and terminal leak/conservation assertions.
- Add two benchmark reports: M2 work/logistics long run and M2 pathing invalidation, each with deterministic invariant extraction.
- Register both benchmarks in the typed benchmark suite, baseline parser/comparer, CLI filters, and default suite.
- Update baseline entries with preserved 10 percent warning and 20 percent blocking thresholds.
- Update testing/performance docs and write a completion report with artifact paths, hashes, and command results.

## Risks

- Long-run samples are deterministic but can be slow because `pnpm bench` samples multiple long-run scenarios.
- Baseline timings are machine-local; artifact metadata must identify Node, pnpm, OS, CPU, commit, seed, scenario, horizon, and final hashes.
- If a gate fails, do not patch product behavior inside WM-0042; keep the failed evidence and block.

## Implementation Steps

1. Add the focused M2 invariant test and local helper readers.
2. Add benchmark report modules and wire them into registry, baseline parsing, CLI support, and exports.
3. Add M2 support to the existing headless runner CLI and `m2-invariants` to the test runner filter list.
4. Generate benchmark artifacts, update baseline JSON, and update docs/report.
5. Run all required checks and any useful full-quality follow-up gate.

## Tests And Baselines

- `pnpm typecheck`
- `pnpm test --filter m2-invariants`
- `pnpm bench`
- `pnpm sim:run -- --seed 2 --scenario m2-work-logistics --ticks 100000`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`

## Rollback

Revert the WM-0042 branch changes, leave M2 open, and do not promote WM-0043 or M3.

## Done

Acceptance is met only when both M2 benchmarks and the long-run invariant test are reproducible, artifacts are present under `coordination/artifacts/WM-0042/**`, thresholds remain 10/20, docs/report are synchronized, and independent review verifies the evidence.
