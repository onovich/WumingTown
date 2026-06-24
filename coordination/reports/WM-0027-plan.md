# WM-0027 - Build Site Material Delivery And Construction

## Goal

Deliver the M1 road lantern frame materials into a build-site buffer, advance deterministic build work, and expose a headless `hauling-building` scenario summary.

## Read Context

- `coordination/tasks/WM-0027.json`
- `docs/02_systems/15_m1_hauling_building_scenario.md`
- `docs/02_systems/06_economy_logistics_production.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/07_roadmap/06_m1_simulation_kernel_plan.md`
- `coordination/decisions/ADR-0003.md`
- `coordination/decisions/ADR-0006.md`
- `coordination/reports/WM-0026.md`

## Non Goals

- No Worker/headless parity work from WM-0028.
- No benchmark closeout work from WM-0029.
- No M2 systems, light spread, production chains, UI, or broad production orders.

## Current Facts And Assumptions

- `ItemStackStore` remains the only authoritative item quantity owner.
- `ReservationLedger` owns claims only; it does not own material quantities.
- Build-site buffers must not become general storage supply.
- `tools/headless-runner/src/index.ts` needs `--scenario hauling-building`.

## Approach

- Add a minimal `BuildSiteStore` with typed lanes for required materials, delivered buffers, explicit delivery/build steps, reason codes, and work-offer sync.
- Reserve source quantity, site material capacity, and source/destination interaction spots before source pickup.
- Convert carried items into build-site inventory exactly once on delivery completion.
- Use integer progress ticks and commit one road lantern frame entity at the build anchor through `LocationStore`/`MapGrid`.
- Add a pure sim-core scenario runner and have the CLI output JSON containing scenario id, final tick, world hash, counters, and invariant flags.

## Risks

- Reservation rollback must stay fail-closed around item and carried-state mutation.
- Build-site buffers must not leak into storage supply offers.
- The long 100000-tick scenario should remain a fast deterministic no-op after terminal state.

## Implementation Steps

1. Add build-site owner store and public exports.
2. Add `m1.hauling_building.road_lantern_frame.v1` scenario runner.
3. Extend `pnpm sim:run` CLI parsing for `--scenario hauling-building`.
4. Add building test filter and regression tests for demand, delivery, construction, failures, and scenario end state.
5. Update docs/report and run required gates.

## Test And Gate Plan

- `pnpm typecheck`
- `pnpm test --filter building`
- `pnpm sim:run -- --seed 1 --scenario hauling-building --ticks 100000`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- Recommended: `pnpm lint`

## Completion Conditions

- Materials conserve across source, carried state, and build-site buffer.
- Demand/build offers update when material state changes.
- Delivery reserves quantity, capacity, and interaction spots before pickup.
- Road lantern frame scenario reaches and stays at expected terminal state.
