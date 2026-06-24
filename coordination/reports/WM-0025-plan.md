# WM-0025 implementation plan

## Role and branch

- Role: simulation-engineer fallback in Beacon.
- Worktree: `D:\WebProjects\WumingTown-WM-0025`.
- Branch: `task/WM-0025-implement-serializable-job-driver-state-machines`.
- Spark is not used because this task defines core job execution, save/restore
  and cleanup contracts used by hauling/building work.

## File ownership

- `packages/sim-core/src/job-core.ts`: explicit JobCore store, driver step
  fields, interruption policy handling, shared cleanup and snapshot/hash
  helpers.
- `packages/sim-core/src/job-core.test.ts`: lifecycle, interruption cleanup,
  structured reasons, save/restore round trip and fail-closed restore tests.
- `packages/sim-core/src/index.ts`: public exports.
- `tools/test-runner.mjs`: `jobs` unit filter.
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`,
  `docs/02_systems/13_save_replay_migration.md`,
  `docs/02_systems/14_explainability_debug_observability.md`: implementation
  notes.
- `coordination/reports/WM-0025.md`: final report.

## Design

- `JobCoreStore` stores job status, driver step, interruption policy, owner
  handle, target id, progress and carried state in explicit numeric lanes.
- Driver APIs expose `createJob`, `enterStep`, `tickJob`, `completeJob`,
  `failJob`, `cancelJob` and `requestInterruption`; there is no Promise,
  Generator, coroutine or closure execution position.
- Terminal paths share cleanup through `cleanupJob`, releasing
  `ReservationLedger` owner/job claims and clearing carried state.
- Snapshot/restore uses `JOB_CORE_SNAPSHOT_VERSION = 1` and validates through a
  scratch store before mutating the target store. `createJobCoreHashFields`
  gives tests and later world hashing a stable canonical input.

## Tests

- Job lifecycle records explicit enter/tick/complete fields and integer
  progress.
- Interruption policies `Never`, `AtSafePoint`, `Immediate` and
  `EmergencyOnly` accept or reject the correct interruption kinds.
- Accepted cancellation/failure cleanup releases reservation claims and clears
  carried state through the same terminal cleanup path.
- Structured failure reasons distinguish path, reservation, material,
  permission, risk, time and target state classes.
- Save/load round trip restores the same explicit step and canonical job hash;
  invalid restore input fails closed.

## Risks

- This task does not implement hauling/building job drivers or item quantity
  transfers. Later tasks must add domain commands around this core instead of
  hiding execution state in callbacks or async chains.
- Carried state is represented as explicit job lanes for cleanup auditing; item
  conservation remains WM-0026 owner-store scope.
