# WM-0028 - M1 Save Replay And Worker Headless Parity

## Goal

Prove the M1 hauling-building scenario has deterministic Node headless, save/load/resume, and Worker parity hashes with structured divergence diagnostics.

## Read Context

- `coordination/tasks/WM-0028.json`
- `docs/05_tech/02_worker_protocol.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/07_roadmap/06_m1_simulation_kernel_plan.md`
- `coordination/decisions/ADR-0004.md`
- `coordination/decisions/ADR-0005.md`
- `coordination/reports/WM-0027.md`

## Non Goals

- No WM-0029 benchmark closeout.
- No WM-0030 M1 closeout.
- No M2 systems, UI mutation authority, platform save UI, or cross-version save compatibility promise.

## Current Facts And Assumptions

- WM-0027 exposes `runHaulingBuildingScenario` as the pure Node/headless scenario surface.
- The existing sim-worker is an M0 protocol spike and does not yet run the M1 scenario.
- Full Save Container v1 is larger than this task; WM-0028 can add the minimal reviewed M1 envelope/sections needed for the hauling-building parity harness and document the scope.

## Approach

- Add a pure sim-core M1 replay/save module that derives periodic hashes from the hauling-building scenario, writes a minimal validated M1 envelope, validates load input as `unknown`, rebuilds derived projections, and resumes to the same final hash.
- Add deterministic read-only projection hashes for render snapshot and UI detail data, without exposing owner stores or mutation APIs.
- Extend sim-worker with an M1 scenario mode keyed by the hauling-building scenario id in `InitSession.catalogVersion`; accepted no-op command ids advance to deterministic checkpoint ticks and publish hashes in read-only snapshots/details.
- Add unit tests for save/load/resume, projection immutability by isolation, diagnostics, and worker/headless parity.
- Extend `sim:replay-test` diagnostics to include the M1 scenario artifacts while preserving the existing M0 behavior.

## Risks

- Worker protocol changes must stay backward-compatible with existing M0 smoke tests.
- Save envelope validation must fail closed and not mutate a live runtime on invalid input.
- Diagnostics must include seed, scenario id, first divergent tick, and artifact paths.

## Implementation Steps

1. Add sim-core M1 replay/save harness and public exports.
2. Add m1-save-replay unit tests and `pnpm test --filter m1-save-replay`.
3. Extend sim-worker M1 mode and worker smoke parity coverage.
4. Extend replay diagnostics artifacts for M1 without removing the existing deterministic probe.
5. Update docs/report and run required checks.

## Test And Gate Plan

- `pnpm typecheck`
- `pnpm test --filter m1-save-replay`
- `pnpm test:e2e --filter worker-smoke`
- `pnpm sim:replay-test`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- Recommended: `pnpm lint`

## Completion Conditions

- Node and Worker M1 hash checkpoints match.
- Save/load/resume final hash matches uninterrupted replay.
- Snapshot/detail projections are read-only outputs and cannot mutate authoritative state.
- Divergence diagnostics include seed, scenario id, first divergent tick and artifact paths.
