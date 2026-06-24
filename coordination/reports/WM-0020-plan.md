# WM-0020 - Spatial Indexes And Location Lifecycle

## Goal

Implement a `sim-core` location owner store plus derived spatial indexes for
cell, chunk, and region queries. Movement, transfer, despawn, and destroy
cleanup must be explicit, deterministic, generation-checked, and covered by
focused tests and a 50k inert entity benchmark.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0020.json`
- `docs/02_systems/02_entities_defs_components.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/06_engineering/01_performance_constitution.md`
- `docs/07_roadmap/06_m1_simulation_kernel_plan.md`
- `coordination/decisions/ADR-0003.md`
- `coordination/decisions/ADR-0006.md`
- Existing `entity-id`, `component-store`, `map-grid`, test runner, and
  benchmark wiring

## Out Of Scope

No WorkOffer selection, reservation semantics beyond cleanup hook surfaces,
path search, UI overlays, Pixi/React/Electron, Worker protocol changes, or save
container finalization.

## Current Facts And Assumptions

- `MapGrid` already owns numeric occupancy lanes, chunk versions, and dirty
  queues, but it does not own entity location.
- `EntityRegistry` is the identity authority and validates index/generation.
- Benchmarks may use Node timing/filesystem through `packages/benchmarks`;
  `sim-core` must stay free of Node, real time, DOM, UI, and ambient randomness.
- Reservation ledger is WM-0023 scope, so WM-0020 will expose explicit cleanup
  hook result counters/stubs without inventing reservation ownership.

## Approach

Add `LocationStore` as the authoritative membership owner with typed lanes for
`none`, `map`, and `container`. Map placement updates derived `MapGrid`
occupancy and a `SpatialIndex` in the same mutation path; container placement
clears map occupancy/index membership. The spatial index uses per-cell linked
lists with deterministic ascending entity iteration for queries and bounded
chunk/region membership counters. Stale generations and invalid coordinates
return structured reason codes.

## Risks

- Linked-list order can become insertion-order dependent after movement; query
  APIs keep each bucket sorted by entity index, so query order stays stable
  without scanning all entities.
- Map occupancy can drift if updated outside `LocationStore`; tests will cover
  move, transfer, despawn, destroy cleanup, and stale generation rejection.
- Benchmark baselines are machine-specific; add a conservative baseline entry
  and record the WM-0020 artifact for review.

## Implementation Steps

1. Add `spatial-index.ts` and `location-store.ts` with explicit cleanup hooks,
   metrics, and public exports.
2. Add focused `spatial-index.test.ts` for exclusivity, movement, transfer,
   stale generation, indexed query ordering, cleanup hooks, occupancy cleanup,
   and no sustained queue growth.
3. Add `spatial-index` support to `tools/test-runner.mjs`.
4. Add `spatial-index` benchmark support, baseline parsing, baseline entry, and
   WM-0020 artifact routing for filtered runs.
5. Update entity/map/performance docs minimally and write
   `coordination/reports/WM-0020.md`.

## Tests And Benchmarks

- `pnpm typecheck`
- `pnpm test --filter spatial-index`
- `pnpm bench --filter spatial-index`
- `pnpm lint`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`

## Rollback

Revert the WM-0020 branch changes before integration. No save compatibility,
UI protocol, pathing behavior, or reservation semantics are introduced.

## Completion Conditions

Acceptance criteria are met, required checks pass, final report records
evidence and ADR links, `taskctl complete` requests independent review, and the
branch is committed and pushed.
