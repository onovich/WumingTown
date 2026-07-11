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

## Architect-approved resume audit

Commit `4175afd` expanded the same task to the exact MapGrid product/test files
and retained the 12-file product/test/export cap and every original threshold.
The original owner followed the task unblock procedure, then repeated the
public API audit.

The revised scope is sufficient without a thirteenth file:

- MapGrid can write passability, walk cost, cell version and cardinal movement
  directly from its existing private lanes into caller-owned outputs without
  touching mutation/version/dirty/snapshot/hash code.
- GridPathfinder can own two reusable MapGrid output lanes and publish paths
  only after the caller route capacity is known.
- WorkOffer version lanes and Into outputs fit wholly in `work-offers.ts`.
- Reservation validation can use primitive `EntityRegistry.isIndexActive` and
  `generationAt`, avoiding the allocating `validate` wrapper, and its complete
  prepared transaction fits caller-owned typed lanes.
- Ability penalty scanning and query output both fit in `m3-health.ts` with
  constructor-owned reusable scratch.
- All additions can be exported from the already-owned package root and tested
  in the exact six owned test files.

No non-additive consumer, snapshot/hash mutation, schema change or hidden
owner surface is required. Product implementation may therefore resume.

## Final checkpoint and blocker

The implementation, public-root focused tests, fixed-seed M1/M2/M3 100000-tick
runs, boundary/handoff/control-plane checks and full quality gate pass. The
source/allocation audit covers the Into methods plus their class and free
helpers; the diff contains 7 product/test/export files against the maximum 12
and no forbidden surface.

The mandatory full benchmark cannot be accepted. Three sandboxed attempts and
one root-approved unsandboxed attempt failed only existing aggregate suites,
although the directly relevant `work-offers`, `pathing-100` and `reservations`
owner-local suites pass. This is not waivable. Preserve the implementation as
a checkpoint, then block WM-0177 to `systems-architect` for an exact-main,
same-environment baseline comparison and independently reviewed performance
decision. WM-0170 remains blocked throughout.
