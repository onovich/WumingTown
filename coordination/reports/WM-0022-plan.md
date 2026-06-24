# WM-0022 implementation plan

## Role and branch

- Role: simulation-engineer fallback in Beacon.
- Worktree: `D:\WebProjects\WumingTown-WM-0022`.
- Branch: `task/WM-0022-implement-versioned-path-request-batching-and-to`.
- Spark is not used because this task owns core deterministic pathing and async
  stale-version semantics.

## File ownership

- `packages/sim-core/src/pathing.ts`: version basis, local A star, batched path
  requests, stale result commit and Top-K exact path candidate helper.
- `packages/sim-core/src/pathing.test.ts`: path version, stale rejection,
  obstacle/no-route, Top-K cap and no long-lived actor-path behavior tests.
- `packages/sim-core/src/index.ts`: public exports.
- `tools/test-runner.mjs`: `pathing` unit filter.
- `packages/benchmarks/src/pathing-100-benchmark.ts` plus benchmark union,
  CLI and baseline files: 100 path benchmark and artifact route.
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`,
  `docs/02_systems/03_map_space_rooms_lanterns.md`,
  `docs/05_tech/03_performance_budget.md`: implementation notes.
- `coordination/reports/WM-0022.md`: final report.

## Design

- `PathVersionBasis` records map, navigation, region, room and region-graph
  versions. Requests and results carry this basis.
- `GridPathfinder` owns reusable typed scratch buffers for local A star over
  `MapGrid`; it reads passability through public map APIs and returns
  structured path reasons.
- `PathRequestBatcher` is a fixed-capacity ring queue. It processes requests in
  enqueue order, reports backlog, accepted results and stale rejects, and only
  accepts a result when its basis matches the current basis at commit time.
- `resolveTopKPathCandidates` uses bounded insertion selection over caller
  supplied candidates and runs exact local pathing only for the selected Top-K.
  It does not discover candidates or scan world state.

## Tests

- Successful local path avoids blocked terrain and reports node expansions.
- Mutating map/region versions makes an older path result stale at commit.
- Batch queue reports backlog and processes request order.
- Top-K resolution performs exact pathing only for the requested cap.
- A request issued with one basis can be reissued after a version change; actors
  get fresh path results instead of reusing incompatible complete paths.

## Benchmark

- `pnpm bench --filter pathing-100` builds a deterministic 32x32 map, enqueues
  100 path requests, processes them, then attempts one stale commit after a
  navigation-version bump.
- Report fields: request count, processed count, accepted count, stale rejects,
  queue backlog peak/final, node expansions, reached paths and checksum.

## Risks

- Region coarse pathing is represented by region-version basis and local A star
  over the current map. A richer region graph edge search can extend the same
  API once region graph edges exist.
- No Job Driver state is introduced; later job tasks must store only request
  basis/sequence and rehydrate fresh paths after compatible results.
