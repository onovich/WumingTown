# WM-0023 implementation plan

## Role and branch

- Role/model: simulation-engineer, Tally-WM-0023B, GPT-5 Codex.
- Worktree: `D:\WebProjects\WumingTown-WM-0023`.
- Branch: `task/WM-0023-implement-reservation-ledger-and-atomic-transact`.
- Existing control-plane changes in `coordination/tasks/WM-0023.json` and
  `coordination/thread-registry.json` are expected and will be preserved.

## File ownership

- `packages/sim-core/src/reservation-ledger.ts`: new authoritative owner store
  for entity, cell, item-quantity, interaction-spot, and capacity reservation
  claims.
- `packages/sim-core/src/reservation-ledger.test.ts`: deterministic unit and
  fuzz-style coverage for contention, capacity, stale handles, cleanup, and
  save round trip.
- `packages/sim-core/src/index.ts`: public exports only, no deep imports.
- `packages/benchmarks/src/reservations-benchmark.ts`,
  `packages/benchmarks/src/benchmarks.ts`, `packages/benchmarks/src/cli-lib.ts`,
  `packages/benchmarks/baseline.json`: reservation benchmark registration,
  invariants, baseline, and artifact routing.
- `tools/test-runner.mjs`: add the `reservations` unit-test filter.
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`,
  `docs/02_systems/13_save_replay_migration.md`, and relevant performance docs:
  document implemented ledger surface, save snapshot fields, and benchmark
  evidence.
- `coordination/reports/WM-0023.md`: final report after checks.

## Design

- Implement `ReservationLedger` as an explicit sim-core store with integer-only
  lanes and stable allocation order. Records include owner entity, job id,
  channel, amount, created tick, and lease expiry tick. Lease expiry is
  persisted/recoverable metadata only; normal release is explicit.
- Transactions validate all requested targets first, then commit all claims or
  none. Validation checks entity generations through `EntityRegistry`, cell and
  capacity bounds, item/capacity amounts, interaction spot conflicts, and
  structured reason codes for conflicts, stale refs, capacity, and amount
  problems.
- Use per-target indexes for normal acquisition and cleanup paths instead of
  scanning the full world. Full scans are limited to explicit validation/debug
  and save/round-trip APIs.
- Integrate destroy/despawn cleanup through the existing `LocationStore`
  lifecycle hook by exposing `releaseReservationsForEntity`.
- Provide serializable snapshot/restore data for the reservation section only,
  without finalizing the full save container.

## Tests

- Add deterministic unit tests for all-or-nothing multi-target acquisition,
  explicit owner/job release, destroy cleanup hook integration, reason-code
  distinctions, stale entity handle rejection, and snapshot round trip.
- Add small seeded fuzz-style tests using a local deterministic integer sequence
  to contend over bounded cells/capacity/items and verify no leaked partials.
- Add `pnpm test --filter reservations` support through the existing runner.

## Benchmark

- Add `pnpm bench --filter reservations` with contention/capacity/item cases,
  leak counters, conflict counts, release counts, and deterministic invariants.
- Update `packages/benchmarks/baseline.json` with the new benchmark entry only
  after measuring locally.

## Risks

- The full Job Driver store is not in scope, so tests will use simple numeric
  job ids and serializable harness records.
- The save container is not finalized, so snapshot/restore remains a ledger
  section surface with versioned fields rather than a complete container.
- Benchmark CLI currently uses Node fs and real elapsed time, but that remains
  outside sim-core and outside authoritative state.
