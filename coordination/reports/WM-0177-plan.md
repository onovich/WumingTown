# WM-0177 Execution Plan

## Objective

Add additive, package-root public, caller-owned hot-path surfaces for the four
generic sim-core owners that block WM-0170. Preserve every legacy allocating
API, deterministic order/hash, snapshot and reason while making version basis
and scratch/output ownership explicit.

## Inputs read and audited

- Repository rules and `wuming-town-agent-workflow`.
- WM-0169 architecture/report, ADR-0018, autonomous-town-life architecture and
  AI/Job/Reservation/pathing system contract.
- WM-0170 blocker, evidence and exact post-WM-0177 resume procedure.
- Current `WorkOfferIndex`, `GridPathfinder`, `ReservationLedger`, health/
  ability cache and package-root exports, including legacy focused tests.

## Implementation plan

1. Add monotonic WorkOffer index and per-row version lanes plus owner-version
   binding. Add caller-owned mutation/read/selection outputs and typed scratch;
   keep legacy methods as allocating compatibility wrappers with unchanged
   selection order and reasons.
2. Split GridPathfinder execution into an allocation-free `findPathInto` core
   using a caller-owned route buffer and flattened result lane. Keep `findPath`
   as the exact legacy materializing wrapper. Reject undersized route output
   before publishing any route cell.
3. Add typed reservation preparation scratch, claim-id output and flattened
   result. `acquireInto` validates the complete header, every owner/target/
   channel fact, pending-claim contention, ledger capacity and output capacity
   before one commit loop; no failure may partially mutate ledger or outputs.
4. Add `queryAbilityInto`, backed by reusable penalty/result lanes, while the
   legacy `queryAbility` wrapper materializes the same historical result.
5. Export every new type/surface from `@wuming-town/sim-core`; add a focused
   public-root test covering identity reuse, version/stale rejection, caps,
   exact path output, every reservation failure/atomicity class and ability
   hit/rebuild/denial/invalid paths.
6. Run source/allocation self-audits and all required focused, 100000-tick,
   benchmark, boundary, handoff and quality gates. Write the final report,
   commit owner changes, then request independent review.

## Compatibility and stop lines

- Existing signatures remain available; their returned object/array behavior
  is intentionally outside the new hot-path proof.
- Existing WorkOffer score/offer-id ordering, path basis/cost/reasons,
  reservation channels/reasons/cleanup, snapshots/hashes and ability metrics
  remain exact.
- New hot methods may write only caller-owned output/scratch and authoritative
  owner lanes after full validation; they contain no per-call object, array,
  typed-array, closure or constructed-string allocation.
- No GameSession/autonomy, protocol, Worker, Web/Pixi/HUD, save, dependency,
  PR-3, content or release file is in scope.
- If exact legacy semantics require a forbidden consumer or schema change,
  stop and block rather than widen scope.

## Pre-code public invariant audit: blocked

The GridPathfinder portion cannot truthfully meet the allocation contract
within WM-0177's allowed paths. `findPath` currently obtains every passability,
neighbor movement and walk-cost fact through these `MapGrid` public methods:

- `isCellPassableByIndex` returns a newly materialized result object;
- `canMoveBetweenCardinalNeighbors` returns a newly materialized result object
  for each relaxed neighbor;
- `readCellByIndex` returns a result object containing another newly
  materialized cell object for each relaxed neighbor.

`findPathInto` can eliminate its final result/path allocation, but it cannot
eliminate these per-node/per-neighbor allocations without a caller-owned or
primitive MapGrid read surface. `packages/sim-core/src/map-grid.ts` and its
tests are outside WM-0177 `allowedPaths`. Accessing MapGrid private lanes,
casting around its public API or claiming only the final route allocation
would leave WM-0170's zero-allocation audit unsatisfied.

The task explicitly requires blocking if a public invariant forces scope
expansion. Implementation therefore stops before product code. The systems
architect must revise WM-0177 (or create a strict predecessor) to own additive
allocation-free MapGrid passability/movement/walk-cost reads and their public
root tests, while retaining all legacy MapGrid results and hashes.
