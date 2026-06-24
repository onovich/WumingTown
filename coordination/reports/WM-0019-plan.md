# WM-0019 - Deterministic Map Grid And Chunk Dirty Queues

## Goal

Implement an authoritative `sim-core` map grid with typed-array cell lanes, chunk dirty/version metadata, stable snapshot/hash hooks, tests, and a focused benchmark.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0019.json`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/07_roadmap/06_m1_simulation_kernel_plan.md`
- `coordination/decisions/ADR-0003.md`
- `coordination/decisions/ADR-0006.md`
- Current `sim-core`, test runner, and benchmark surfaces

## Out Of Scope

No pathfinding, reservations, room graph rebuilds, spatial indexes, jobs, renderer/UI work, Worker protocol, or final save container implementation.

## Current Facts And Assumptions

- `sim-core` currently exposes deterministic hashing, entity ids, component stores, structural commands, and M0 runner snapshots.
- `tools/test-runner.mjs` does not yet route `--filter map-grid`.
- `packages/benchmarks` owns Node timing/filesystem behavior; `sim-core` must stay free of those dependencies.
- Map snapshot hooks should expose authoritative stable-order data only, not a save container contract.

## Approach

Add a `MapGrid` owner store with width/height/chunk dimensions, typed-array lanes for terrain, occupancy, walk cost, region id, room id, per-cell version, and per-chunk version/dirty metadata. Mutations validate integer coordinates and values, advance deterministic versions only on real changes, enqueue chunks once, and expose budgeted dirty processing.

## Risks

- Snapshot/hash output can become too large if represented as object-per-cell; mitigate by stable field generation and snapshot typed-array clones.
- Dirty queues can grow on repeated writes; mitigate with per-chunk queued flags and tests for unchanged worlds.
- Benchmark baselines are machine-specific; use a conservative initial baseline and report the artifact for review.

## Implementation Steps

1. Add `map-grid.ts` and public exports.
2. Add focused `map-grid.test.ts` covering storage, validation, dirty queues, snapshot/hash stability, and invariants.
3. Add `map-grid` test filter.
4. Add `map-dirty` benchmark, CLI baseline parsing, and baseline entry.
5. Write final report and run required checks.

## Tests And Benchmarks

- `pnpm typecheck`
- `pnpm test --filter map-grid`
- `pnpm bench --filter map-dirty`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`

## Rollback

Revert the WM-0019 branch changes before integration. No external save compatibility or UI protocol is introduced.

## Completion Conditions

Acceptance criteria are met, required checks pass, `coordination/reports/WM-0019.md` records evidence including ADR-0003 and ADR-0006, `taskctl complete` is run, and the branch is committed and pushed.
