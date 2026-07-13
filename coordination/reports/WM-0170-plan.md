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

## Canvas B2 repair plan and completed evidence

Canvas returned `changes_requested` on checkpoint `1319643`. The repair stays
inside B2 and the existing selection/test/report ownership; B3 mutation,
`taskctl complete`, integration and merge remain prohibited. The seven findings
are closed as follows:

1. Exact-path freshness now binds the returned request sequence, start cell and
   goal cell as well as the five authoritative basis fields and their live
   values. Three independent mismatch regressions prove no route publication or
   copy and one `stalePathCount` increment per rejected attempt.
2. Active work eligibility no longer consults the two-new-decisions counter.
   Only a new selection or interruption calls `consumeDecisionSlot`; after two
   selections, an active non-interruptible third resident still returns KEEP
   with usage two, while another new selection defers.
3. A fixed scalar rejection accumulator retains the highest-priority causal
   denial across sources: safety, treatment, movement, permission, closed work
   mask and off-shift window. Food, Rest, Medical and Ordinary plus multi-denial
   priority are tested; only a genuinely empty eligible index reports
   `IDLE_NO_INDEXED_OFFER`.
4. Numeric pre-gate classification separates Need, schedule/wake, capability,
   candidate and Job staleness. Owner dirty/stale failures increment candidate
   staleness. Budget-aware failure publishes the actual visited, ingress,
   retained, scored, selected, path and node-expansion work already performed;
   regressions fail during the second and third enabled sources.
5. The former substring/source-count audit is removed. A TypeScript `Program`
   and `TypeChecker` starts only at
   `ResidentAutonomyCoordinator.decideInto`, follows resolved declaration
   identity through private/free helpers and concrete owner methods, rejects
   every unresolved or unexpected external call, and checks every reached body
   with an AST allocation/string/higher-order visitor.
6. The first repaired closure was 239 declarations: 91 selection declarations plus
   148 owner declarations, zero unresolved calls, 13 receiver-exact dynamic
   owner roots and exactly 34 approved native keys (29 typed-array `fill`, two
   `Number`, three `Math`). The duplicate-free manifest digest is
   `d02dea82-d7357816`; a fake `selectCandidatesInto` receiver is rejected.
7. The 98-line/complexity-30 medical query and 77-line/complexity-12 path loop
   are split, as are the four bounded admission loops, source eligibility and
   Food/Rest/Ordinary option writers. The remaining explicit structural audit
   is recorded function by function in the report with its fixed bound and why
   further splitting would only fragment straight-line validation/comparison.

## Canvas second B2 repair plan and completed evidence

Canvas returned a second `CHANGES REQUESTED / B2 PHASE FAIL` on checkpoint
`8f7f360`. Only two blockers are repaired; B3, generic owner edits,
`taskctl complete`, integration and merge remain prohibited.

1. Source ability querying now has a fixed numeric
   `ALLOWED / DENIED / STALE` result, while each Food/Rest/Medical/Ordinary
   wrapper returns the fixed source result `OK / STALE_CAPABILITY /
STALE_OWNER`. Only the top-level `STALE_CAPABILITY` branch increments
   capability stale and terminates with `CAPABILITY_STALE_BASIS`; only
   `STALE_OWNER` increments candidate stale. Four parameterized regressions make
   the two hard ability queries succeed and the target source ability query
   stale. They preserve prior source budgets at visited/ingress `0/0`, `2/0`,
   `10/8` and `8/6` for Food through Ordinary, keep scratch identities and prove
   AutonomyStore/ReservationLedger snapshots unchanged.
2. The same TypeChecker BFS now resolves actual get/set accessor identity for
   reads, assignments and compound updates, and scans each complete declaration
   rather than only its body. It rejects for-of, spread/rest, async and generator
   syntax in addition to the existing allocation/string/higher-order checks.
   In-memory fixtures run through that same Program/BFS/scanner path and prove
   allocating getter, allocating setter, compound get+set, a real checker-bound
   fake receiver and every new syntax category behave fail closed.
3. Canvas predicted 241 declarations, but the complete resolver found a third
   real reachable getter: `M3HealthConditionStore.get storeVersion`, reached
   through Medical selection, alongside `ReservationLedger.get version` and
   `RestSleepStore.get version`. The truthful final manifest is therefore 242:
   91 selection plus 151 owner declarations, zero unresolved calls, 13 dynamic
   owner roots, three accessor roots and the same 34 native keys. Its fixed
   duplicate-free digest is `35ee66c9-b731fe5d`.
4. Independent positive dynamics call each real source owner once: Food empty
   candidate query, Rest real fixture query, Medical valid-caregiver empty
   request query and Ordinary real offer query. Each preserves source
   scratch/output/global-retained identity and both authoritative snapshots.

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

## B3 plan gate after the passed B2 checkpoint

Canvas passed B2 at checkpoint `59c9731`. The B3 API/architecture audit is
read-only and freezes the decisions below. This section supersedes any earlier
wording that could be read as allowing WM-0170 to create a JobCore job or enter
`moving`/`working`. No B3 product implementation starts until Canvas accepts
this plan and the strict prerequisite below is independently implemented,
reviewed and integrated.

### Frozen B3 endpoint and WM-0171 handoff

1. WM-0170 B3 may perform exactly one successful state publication:
   expected `idle` row/version `r` to `claiming` row/version `r + 1`.
2. The published claiming row has `jobId = NONE`,
   `pendingJobId = claimPlan.transaction.jobId`, the already-selected bounded
   route, the exact claim ids returned by the one successful acquire, reason
   `RESERVATION_ACQUIRED`, and reservation basis equal to the successful
   acquire output version. It preserves the selected source, candidate, target
   and every revalidated owner/path basis.
3. WM-0170 must not publish `moving` or `working`. Those states require an
   active JobCore job and required claims under ADR-0018 and the integrated
   architecture; WM-0170 is forbidden to mutate JobCore or GameSession and
   therefore cannot prove that invariant.
4. WM-0171 owns the second publication after real JobCore creation/entry:
   expected claiming row/version `r + 1` to `moving` or `working` row/version
   `r + 2`, bind `jobId = pendingJobId`, clear `pendingJobId`, bind a real
   positive JobCore `jobVersion` and interruption policy, and preserve the
   route/claims without a release/reacquire gap.
5. While WM-0170 still has `jobId = NONE`, the current Store policy requires
   `interruptionPolicy = NONE` and `basis.jobVersion = 0`. B3 therefore treats
   any supposedly inactive Job projection with a job id, policy or non-zero
   version as stale before mutation; it does not fabricate a future binding.

### Strict prerequisite: exact zero-allocation claim compensation

The current `ReservationLedger.acquireInto` is suitable for the forward
transaction, but neither current rollback entry point is suitable for B3.
`releaseClaims(readonly number[])` and `releaseReservationsForOwnerJob` return
new result objects; the former also uses `for-of` and does not reject duplicate
ids before mutation. Claim ids are allocated only by the successful acquire,
so pre-acquire Store validation can check shape and predicted version but
cannot validate the exact ids that will be published or make an injected
post-acquire failure impossible.

Before B3 resumes, an independently owned prerequisite must add and review the
minimum generic ledger surface below. Beacon will coordinate that task only
after Canvas formally accepts this plan; WM-0170 does not create or modify its
task JSON.

```ts
interface ReservationReleaseIntoOutput {
  ok: boolean;
  reason: ReservationReason | undefined;
  claimId: number;
  releasedCount: number;
  version: number;
  activeCount: number;
}

releaseClaimsInto(
  claimIds: Uint32Array,
  claimCount: number,
  output: ReservationReleaseIntoOutput,
): void;
```

The exact accepted naming may follow ledger conventions, but the reviewed
contract must satisfy all of these mechanical requirements:

- reset the caller-owned output on every call and allocate no object, array,
  closure or string on the reachable call chain;
- reject an invalid count, `NONE`/out-of-range id, inactive id or duplicate id
  before releasing any claim;
- on success release exactly the first `claimCount` ids, update every channel,
  owner/target link, capacity amount, active count, free lane and metric exactly
  once, then advance ledger version exactly once when the count is non-zero;
- on failure leave all authoritative claims, counts, links, amounts, free lanes,
  version and release metrics unchanged and return the first deterministic
  offending id/reason in the reused output;
- use index-bounded loops rather than `for-of`, preserve the input/output/typed-
  lane identities, and expose the API from the existing package public entry;
- prove invalid-first, invalid-middle, invalid-last, inactive, duplicate and
  mixed-channel atomic rejection; exact entity/cell/interaction/item/capacity
  success; output reuse; version/metric behavior; full-capacity/reused-id
  behavior; and a TypeChecker-based allocation-free transitive closure.

This prerequisite is a stop line, not an optional optimization. A successful
acquire followed by exact Store validation or publication failure cannot be
safely compensated under the WM-0170 hot-path rules without it.

### Exact B3 resume procedure after prerequisite integration

1. Confirm Canvas plan PASS, prerequisite task `done`, prerequisite integration
   reachable from current `main`, clean single worktree, and WM-0170 still owned
   by Tally/in progress. Run workflow validation/status; do not reclaim or
   complete the task.
2. Rebase or otherwise refresh the existing WM-0170 branch only through the
   project workflow chosen by Beacon, then rerun the B2 focused suite,
   typecheck and closure audit unchanged. Stop on any baseline regression.
3. Re-read the integrated `releaseClaimsInto` implementation, public export,
   tests and independent review. Verify its actual signature against this
   contract and add it to the B3 TypeChecker closure before editing coordinator
   production code.
4. Implement B3 only in the already-approved autonomy selection/types/store
   modules and focused autonomy test/report unless Canvas explicitly approves a
   narrower revised file list. Do not modify ReservationLedger again inside
   WM-0170.
5. Execute the ordered revalidation, plan, prevalidation, acquire, exact
   publication and compensation sequence below; run the complete B3 matrix and
   scoped gates; update the report; push a B3 checkpoint and stop for independent
   Canvas implementation review. Do not run `taskctl complete` until that review
   passes.

### Ordered B3 hot-path sequence

Every call uses construction-time injected owners plus caller-owned scratch and
outputs. No world, LocationStore, item/target owner, JobCore or GameSession state
is changed by this sequence.

1. Re-read the resident autonomy row. Require the same resident generation,
   `idle` state, row version and Store version selected by B2.
2. Re-read active actor identity, all five Need values and their owner versions,
   schedule/work/permission/meal/weather facts, wake facts, consciousness,
   movement, the selected-source ability and the inactive Job projection.
   Compare every value and version retained by B2; re-apply the hard safety
   gates. Failure stops before claim-plan access.
3. Re-read the selected owner row and its index/source basis using the matrix
   below. The candidate id, target id/cell and source-local policy facts must
   still match B2 exactly. Failure stops before claim-plan access.
4. Re-read the complete path basis and verify map, navigation, region, room and
   region-graph versions, route length `1..128`, valid route cells, target-cell
   endpoint and cleared tail. Failure stops before claim-plan access.
5. Reset the fixed claim-plan output and call
   `claimPlans.readPlanInto(...)` exactly once. Validate the returned header,
   fixed refs, aliases, transaction and fixed claim slots without allocation.
6. Build a provisional claiming transition in existing scratch, using valid
   placeholders for the not-yet-known claim ids and predicted success ledger
   version `current + 1`. Call `validateTransitionInto` before acquire. This
   proves all caller-controlled Store shape relations but is not treated as
   proof of the future exact claim ids.
7. Call `ReservationLedger.acquireInto` exactly once. On failure, publish no
   autonomy row and classify the returned structured reservation reason.
8. On success, copy exactly `output.claimCount` returned ids into the fixed
   transition claim lane, clear its tail, bind the actual acquire version and
   re-run `validateTransitionInto` against the exact claiming row.
9. Call `transitionInto` once only after exact validation. Success publishes the
   claiming endpoint defined above. Any exact validation or transition failure
   calls integrated `releaseClaimsInto` once with precisely the ids/count from
   this acquire and returns a structured publication/compensation result.
10. A compensation failure is a fail-closed invariant breach: retain the exact
    acquire/release evidence in caller-owned output/metrics, publish no autonomy
    row, perform no broad owner/job cleanup, and surface the failure for the
    authoritative caller. B3 must never silently continue with leaked claims.

### Selected-source revalidation matrix

| Source | Required fresh reads and exact relations before plan access |
| --- | --- |
| Food | `readPortionInto(candidateId, output)`; active/linked/safe/permission/schedule and available amount remain valid; stack/target/cell match; `foodAvailabilityVersion` equals selected owner/index basis, `itemStoreVersion` equals selected row/item basis, meal-window id/version match, and both current/selected dirty backlog are zero. |
| Rest | `readFixtureInto(candidateId, output)` plus a fresh bounded `RestCandidateIndex.selectCandidatesInto` with the retained B2 query/environment; find the same fixture in the caller-owned result; source/store/current/cached row versions, index version, zero backlog, target/entity/kind/region/spot/schedule/weather/exposure/outdoor/permission facts all match. A row read alone is insufficient because it does not expose index source/backlog facts. |
| Medical | `readPatientRequestInto` for the candidate, `readCaregiverStateInto` for the selected caregiver, and fresh `queryAbilityInto`; patient/caregiver/condition/health/medical/base-ability/actor-condition versions and all target/region/permission/treatment/stock/amount facts match; caregiver remains valid/allowed and ability remains at least the selected minimum. |
| Ordinary | `WorkOfferIndex.readOfferInto(candidateId, output)`; owner, row and index versions, work type, region, definition, urgency, permission, target id/cell, score and the selected descriptor/query fields match exactly. |

Need, schedule, wake, capability, Job and path validation are common to all
four sources and run once, not once per owner. The B2 snapshot must retain a
baseline for every compared fact. In particular, before implementation the B3
types/store snapshot lane adds the wake event version captured at selection;
comparing only current wake facts without a retained version is prohibited.
This is an autonomy-owned basis addition, not a generic wake-owner edit.

### Claim-plan structural acceptance

After the single plan call and before acquire, all of the following must hold:

- output/header/transaction/claims-array/ref/slot identities are unchanged from
  construction; transaction owner aliases the fixed owner ref; every emitted
  claim aliases one of the eight fixed slot refs and no slot is repeated;
- header is successful and exactly echoes selected source, candidate, target
  and target cell; `pendingJobId` is valid and equals
  `transaction.jobId`; transaction owner is the exact resident;
- `createdTick` equals the request tick, lease expiry is not earlier, and
  `header.claimCount === transaction.claims.length` is in `1..8` and fits every
  reservation/transition output capacity;
- there are no holes, duplicate claim objects or cross-slot target/item aliases;
  every source-required entity, cell, interaction, quantity or capacity claim
  refers to the revalidated owner facts; route and target remain consistent;
- a failed or malformed plan never reaches acquire. The fixed plan output is
  reset so no prior pending id, ref, claim or scalar can leak into the result.

### Mechanical failure and call-count matrix

| Case | Plan / acquire / transition / release calls | Required authoritative result |
| --- | --- | --- |
| Any autonomy, Need, schedule/wake, capability, owner, Job or path stale basis | `0 / 0 / 0 / 0` | AutonomyStore and ledger snapshots unchanged; increment exactly the matching stale class once; retain B2 actual visited/ingress/retained/scored/path work without a second budget aggregation. |
| Claim-plan failure or malformed aliases/header/claims | `1 / 0 / 0 / 0` | Both snapshots unchanged; return exact plan/invariant reason; do not count a reservation conflict. |
| Provisional Store validation failure | `1 / 0 / 0 / 0` | Both snapshots unchanged; return structured publication-shape failure. |
| Acquire conflict, shortage, capacity or invalid transaction | `1 / 1 / 0 / 0` | AutonomyStore unchanged; no partial claims/amounts/active-count change; claim-id output tail reset to `NONE`; increment reservation conflict only for the defined conflict/shortage/capacity classes. |
| Successful acquire and claiming publication | `1 / 1 / 1 / 0` | One claiming row at `r + 1`; exact active claim ids/count and acquire version persisted; no Job/world/position/item/target mutation. |
| Successful acquire, then exact validation or injected transition failure | `1 / 1 / 0..1 / 1` | AutonomyStore snapshot exactly unchanged; active records/counts/channel amounts restored to pre-acquire semantics by exact compensation. Ledger version and acquired/released metrics truthfully advance for acquire plus release and are not asserted byte-identical. |
| Compensation rejection/failure | `1 / 1 / 0..1 / 1` | No autonomy publication or broad cleanup; fail closed with exact acquired ids and rollback reason exposed; test-only injection proves this branch cannot be reported as success. |

Every branch also proves scratch/output/typed-array/ref identities, deterministic
reason and metric deltas, cleared unused tails, one selected resident only and
zero legacy materializer calls. Acquire rejection tests cover first/middle/last
claim failures and prove transaction atomicity rather than only active count.

### B3 allocation and boundary closure gate

The existing TypeScript `Program`/`TypeChecker` BFS is extended from
`ResidentAutonomyCoordinator.decideInto` through all newly reachable B3
declarations and accessors. The positive manifest must include at least
`validateTransitionInto`, `transitionInto`, the concrete fixed claim-plan
provider(s), `acquireInto`, integrated `releaseClaimsInto`, Food/Rest/Medical/
Ordinary fresh reads, Rest fresh indexed selection and ability query. It keeps
receiver-exact identity, complete declaration/accessor scanning, duplicate-free
manifest/digest and zero unresolved or unexpected calls.

`AutonomyClaimPlanSource.readPlanInto` is a dynamic interface boundary; the
checker must not pretend that its interface declaration supplies a concrete
body. Each construction-approved provider is separately audited as a fixed
caller-owned Into closure, and a fake same-name receiver/provider must fail
closed. Synthetic negatives cover allocation, interpolation/concatenation,
higher-order calls, `for-of`, spread/rest, async/generator syntax, allocating
getters/setters and unresolved dynamic receivers.

The production closure forbids `releaseClaims`,
`releaseReservationsForOwnerJob`, reservation `createMetrics`/`createSnapshot`,
legacy materializing owner APIs, unbounded scans/sorts and all JobCore, world,
LocationStore, item/target owner or GameSession mutation. Snapshot creation is
test-only. Final B3 gates are scoped typecheck, the complete focused autonomy
suite, prerequisite ledger regression suite, allocation/closure negatives,
package-boundary checks and updated WM-0170 report evidence, followed by an
independent Canvas review checkpoint.
