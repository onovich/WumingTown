# WM-0170 Execution Plan

## Objective

Implement the protocol-neutral PR-2 resident autonomy primitives only after
the existing public owner surfaces can prove version-coherent, allocation-free
indexed selection and atomic claiming. Keep default GameSession integration,
generic owner stores, protocol, Worker, Web, save and PR-3 commands out of
scope.

## Inputs read

- `AGENTS.md` and the complete `wuming-town-agent-workflow` skill.
- WM-0170 and its completed WM-0169 planning task, plan and report.
- ADR-0018 and the autonomous-town-life architecture, especially activity
  state, decision ordering, caps, ownership and allocation stop lines.
- The playable-product roadmap and the AI/Job/Reservation/pathing system
  contract.
- Public exports and implementations for `WorkOfferIndex`, pathing,
  `ReservationLedger`, needs, health/ability and day/night schedule facts.

## Planned implementation sequence

1. Audit the public owner APIs before changing product code. Confirm that an
   offer can be tied to an owner version, exact paths can be written into
   caller-owned scratch, and one atomic reservation transaction can use
   caller-owned prepared/claim-id lanes.
2. If the audit passes, add the exact typed activity lanes and internal
   snapshot/restore contract for idle, claiming, moving, working, blocked,
   completed, failed and interrupted.
3. Add numeric structured reason lanes with enumerated code/source/suggestion,
   optional scalar subject/target and at most six ordered scalar parameters.
4. Add deterministic arbitration and indexed WorkOffer selection with caps
   24/12/4, two new decisions per tick, stable score/offer/target tie-breaks,
   reusable typed scratch and complete cap/stale/conflict metrics.
5. Revalidate need, schedule, capability, offer-owner and path-owner versions
   before exactly one atomic ReservationLedger transaction. Prove stale or
   failed claiming has no side effects.
6. Add focused state-machine, snapshot, cap, scan, allocation, stale-basis and
   atomic-conflict tests; run all WM-0170 checks, report, commit and request
   independent review.

## Public API audit history: WM-0177 ordinary PASS, WM-0181 need-driven PASS

Commit `2ac4416` resumed WM-0170 after reviewed prerequisite WM-0177 was
integrated. Its audit proved the ordinary WorkOffer, path, reservation and
ability surfaces below. The later independent B1 review correctly required the
same audit for the architecture-mandated Food, Rest and Medical sources:

- `WorkOfferIndex.registerOfferInto`, `updateOfferInto`, `removeOfferInto`,
  `readOfferInto` and `selectTopOffersInto` bind every selected row to its
  producer `ownerVersion`, monotonic `rowVersion` and monotonic `indexVersion`.
  Selection also writes target, cell, score and cap counters into caller-owned
  typed lanes.
- `MapGrid.readMovementCellByIndexInto` and
  `canMoveBetweenCardinalNeighborsInto` expose non-materializing movement facts.
  `GridPathfinder.findPathInto` writes a bounded route and flat result into
  caller-owned storage while preserving the complete map/navigation/region/
  room/region-graph basis. Capacity failure reports required length and leaves
  caller route bytes untouched.
- `ReservationLedger.acquireInto` uses caller-owned prepared lanes, claim-id
  output and result output. It validates the header, every owner/target handle,
  every existing conflict, all within-request duplicates and total ledger
  capacity before its single atomic commit.
- `M3AbilityCacheStore.queryAbilityInto` and its penalty helper reuse flat
  outputs and expose both `actorConditionVersion` and `baseAbilityVersion`.
  `NeedStore` exposes per-lane owner versions, and day/night facts expose the
  current `scheduleWindowVersion` for the later claim revalidation basis.
- All required types/classes are reachable from the package root. The focused
  owner-surface suite audits 11 roots, 42 class helpers and 27 free helpers as
  one allocation-free transitive closure. Typecheck and all 52 focused tests
  passed during the audit.

The legacy materializing APIs remain available for compatibility. They cannot
be called by the WM-0170 hot path.

### Historical second stop-line and resolution

Canvas independently found that the old Food, Rest and Medical selection
surfaces materialized result objects and lacked reviewed caller-owned row
reads. An independent systems-architect rejected mirroring those sources into
generic WorkOffer rows because that would duplicate owner truth and lose
meal-window, rest schedule/weather, patient-condition and caregiver basis.

WM-0181 repaired the exact generic owners and was independently reviewed,
integrated and marked done before this resume. The resumed audit now passes for
`selectCandidatesInto`/`readPortionInto`,
`selectCandidatesInto`/`readFixtureInto`, and
`selectTreatmentRequestsInto`/`readPatientRequestInto`/
`readCaregiverStateInto`, including complete source versions, dirty backlog and
24/12 cap enforcement. WM-0170 did not modify those owners.

## Exact resumed B1 repair sequence

1. Re-audit every public owner `Into` surface and package-root export. Stop if
   any required fact cannot be read allocation-free and version-bound.
2. Replace offer-only autonomy identity with current and terminal
   `candidateSourceCode` plus `candidateId`; persist the complete generic and
   source-specific basis and reject cross-source residue.
3. Keep idle-to-idle illegal in the transition table while adding the narrow
   `refreshIdleInto` store path for WAIT. NONE remains initial-only; active and
   terminal rows require a real source.
4. Freeze exactly five coordinator-owned candidate lanes (Food, Rest, Medical,
   Ordinary, Wait), one shared 24/12/4 budget and the already-approved two-new-
   decisions-per-tick contract. Do not implement arbitration in B1.
5. Replace the flat claim-plan output with a caller-preallocated mutable header,
   owner/target/item refs, transaction, claims array and eight fixed claim-slot
   objects. Reset and bind only in place; preserve the `pendingJobId === jobId`
   handoff and exact-claim rollback obligation.
6. Prove only mechanical B1 contracts: source/basis/pending snapshot roundtrip,
   atomic rejection, WAIT refresh, and output/array/ref/slot identity. Leave
   five-source arbitration/acquire/rollback/closure behavior to the next
   coordinator phase and independent review.
7. After Canvas review of `39cf63a`, align accepted source basis with the exact
   owner success domain: Food and Rest dirty backlogs are zero; Rest cached and
   current fixture versions match, source equals store, and outdoor exposure is
   allowed; Medical caregiver value meets its minimum. Keep owner-valid
   supplemental versions at uint32, including zero.
8. Validate claim-plan reference aliases without allocation. Reset standalone
   and embedded refs separately so malformed aliases cannot retain stale ids;
   reject binding when transaction-owner or slot target/item aliases differ.
9. Add transition and raw-snapshot atomic rejection for every reviewed relation,
   plus zero-version roundtrips, then rerun only the scoped B1 gates and stop for
   Canvas re-review.

## Frozen API and state-lane design

- `ResidentAutonomyStore` owns one fixed typed-lane row per resident. The exact
  states are `idle`, `claiming`, `moving`, `working`, `blocked`, `completed`,
  `failed` and `interrupted`. Rows contain only scalar resident/source-local
  candidate/job/pending-job/target references, state/retry ticks, bounded
  route/claim references and the
  complete need/schedule/capability/candidate/path/reservation/job version basis;
  they never duplicate owner quantities, position, progress or claim truth.
- Legal transitions are table-validated. Caller-owned read and transition
  outputs are reset on every call. A separate last-terminal record preserves
  completion, failure or interruption evidence after the resident returns to
  idle. Snapshot/restore copies every execution lane needed to resume the
  explicit state machine without Promise, generator, closure or object identity.
- Structured reasons are numeric lanes: enumerated code and source, optional
  scalar subject and target, zero to six ordered scalar parameters, owner basis
  and enumerated suggestion. Every idle/need/capability/offer/path/reservation/
  blocked/failed/interrupted outcome maps to a specific code; prose and generic
  fallback reasons are not valid stored state.
- Selection is explicitly two phase. Phase one arbitrates safety, current
  non-interruptible work, schedule, all fixed need lanes,
  capability/permission, need-driven food/rest/treatment exact indexes,
  ordinary WorkOffers and bounded wait; it persists the numeric source code,
  selected source-local version basis and a
  caller-owned route. Phase two immediately re-reads every owner basis and then
  calls `ReservationLedger.acquireInto` exactly once. Only successful atomic
  acquisition publishes the already-prevalidated bounded route/claim refs and
  next state.
- Fixed caps are one shared 24 visited, 12 retained/scored, 4 exact paths and 2 new decisions
  per tick, 128 route cells and 6 reason parameters. Ordering is score
  descending, then source-row id ascending, target id ascending and fixed source-slot
  order. Metrics expose totals, each cap hit, exact paths, node expansions, stale classes,
  reservation conflicts and decision deferrals.

## Canvas-approved B2 execution and final implementation

The initial five-head merge was rejected because candidate-specific distance,
continuity and retry can reverse owner raw order. Canvas approved the following
bounded two-stage coordinator and then passed the revised B2 plan:

1. Validate the construction-only policy and defensively copy every typed lane.
   Ordinary policy has 1..8 exact descriptors per class/schedule and rotates by
   authoritative tick/fixed cadence plus stable resident identity; caller path
   sequence never affects work selection.
2. Validate resident, schedule/job/wake source tick/generation/capacity/codes,
   active Need actor and all five need lanes, consciousness/movement, active job,
   per-source ability/permission and exact owner bucket. Safety is a hard gate.
3. Count enabled real sources and assign deterministic quotas: N=1 -> 12,
   N=2 -> 12 each, N=3 -> 8 each, N=4 -> 6 each. Owner actual visits sum to
   at most 24; `candidateCap === maxSelected === quota`.
4. Compute only `ownerRaw + sourceHardPriority` during ingress and maintain one
   coordinator-owned fixed raw Top-12. Physical 12-row Food/Rest/Medical Into
   arrays are owner-API buffers, not independent budgets.
5. Run the complete checked common scorer exactly once for each retained row,
   so `retainedCount === scoredCount <= 12`; reorder the same lanes in place by
   common score descending then row, target and slot ascending. Raw rank 13 is
   allowed to be a documented approximation loss.
6. Attempt exact paths in that final order, at most four, incrementing path-only
   request sequence, clearing route tails, accumulating node expansions and
   rejecting changes to map/navigation/region/room/region-graph basis.
   `maxNodeExpansions` is not a basis.
7. Keep B2 read-only. No claim-plan read, acquire/release, autonomy transition,
   idle refresh, Job/world mutation or B3 revalidation/publication is performed.

Implementation landed first at checkpoint `ca23f19` and the final A-E matrix is
recorded in `coordination/reports/WM-0170.md`. B2 stops after its final pushed
checkpoint for independent Canvas review; it does not run `taskctl complete`.

## Implementation stop lines

- Stop and block if any required operation needs a sixth product/test file,
  `index.ts`, a generic owner, GameSession, protocol, Worker, Web/Pixi, save,
  dependency, benchmark or admission change.
- Stop rather than scanning all offers, entities or map cells, allocating on a
  resident/tick hot call chain, copying owner truth, mutating a Job directly for
  an emergency, or claiming from a stale basis.
- Stale selection, route-capacity failure, reservation conflict and any output
  validation failure must leave JobCore, routes, positions, items, targets and
  ledger state unchanged. Post-acquire publication must be prevalidated or
  release exactly the claims acquired by that call.

## Scope guards

- Only the four approved `game-session-autonomy-*.ts` modules and the single
  focused autonomy test may be created for product/test implementation.
- No generic WorkOffer, pathing, ReservationLedger, needs, schedule, health or
  ability owner is modified as a workaround.
- No GameSession integration, protocol, Worker, Web/Pixi/HUD, save, dependency,
  PR-3 or release surface is changed.
