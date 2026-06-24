# WM-0024 implementation plan

## Role and branch

- Role: simulation-engineer fallback in Beacon.
- Worktree: `D:\WebProjects\WumingTown-WM-0024`.
- Branch: `task/WM-0024-implement-workoffer-indexes-and-bounded-reason-t`.
- Spark is not used because this task defines core work-selection indexes,
  bounded reasoning data and benchmark contracts used by later Job Driver work.

## File ownership

- `packages/sim-core/src/work-offers.ts`: WorkOffer index, bounded candidate
  selection and ReasonTrace ring buffer.
- `packages/sim-core/src/work-offers.test.ts`: registration/update, exact key
  lookup, candidate caps, bounded scoring and trace storage tests.
- `packages/sim-core/src/index.ts`: public exports.
- `tools/test-runner.mjs`: `work-offers` unit filter.
- `packages/benchmarks/src/work-offers-benchmark.ts` plus benchmark union, CLI
  and baseline files: 100 pawn / 10k offer benchmark and artifact route.
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`,
  `docs/02_systems/14_explainability_debug_observability.md`,
  `docs/06_engineering/01_performance_constitution.md`: implementation notes.
- `coordination/reports/WM-0024.md`: final report.

## Design

- `WorkOfferIndex` is a derived index, not an owner of job, item, reservation
  or location state. Producers register, update or remove offers when owner
  state changes.
- Offers are keyed by exact composite buckets: work type, region, def, urgency
  bucket and permission id. Lookup reads only that bucket and uses stored bucket
  counts to report candidate totals without traversing every offer.
- Candidate scoring is bounded by caller-supplied `candidateCap` and selected
  by score descending, then stable offer id. It never scans all offers and does
  not perform unbounded sorts.
- `ReasonTraceStore` is a fixed-capacity ring buffer. Selection records include
  candidate counts, visited/scored counts, cap rejection counts, semantic
  rejection reason and selected offer id/score.

## Tests

- Register/update/remove offers and verify old buckets no longer return moved
  offers.
- Query exact composite keys by work type, region, def, urgency and permission.
- Prove candidate caps bound visited/scored offers even when a bucket contains
  more candidates.
- Select top offers from only the bounded candidate input with stable tie
  ordering.
- Store bounded ReasonTrace entries and overwrite oldest entries in ring order.

## Benchmark

- `pnpm bench --filter work-offers` registers 10,000 offers across 100 exact
  pawn query buckets, then runs 100 pawn-thinking lookups.
- Each pawn sees a bucket of 100 offers but visits/scores at most 8. The report
  records pawn count, offer count, bucket candidates, visited/scored counts,
  selected count, candidate-cap hits, trace count and checksum.

## Risks

- This task does not implement authoritative Job Driver, item storage or build
  site producers. Later tasks must use `WorkOfferIndex` as a derived surface
  updated from their owner-store state changes.
- Permission remains a compact integer key for M1. Rich policy expansion should
  compile to permission ids or prefiltered producer updates, not ad hoc scans.
