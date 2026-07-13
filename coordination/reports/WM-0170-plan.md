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
this plan and the two strict prerequisites below are independently implemented,
reviewed and integrated.

### Frozen B3 endpoint and WM-0171 handoff

1. WM-0170 B3 may perform exactly one successful state publication:
   expected `idle` row/version `r` to `claiming` row/version `r + 1`.
2. The published claiming row has `jobId = NONE`,
   `pendingJobId = claimPlan.transaction.jobId` and positive
   `pendingJobGeneration` from the exact JobCore reserved token, the already-
   selected bounded route, the exact claim ids/allocation epochs returned by the
   one successful acquire, reason `RESERVATION_ACQUIRED`, and historical
   reservation basis equal to the successful acquire output version. It
   preserves the selected source, candidate, target and every revalidated owner/
   path basis.
3. WM-0170 must not publish `moving` or `working`. Those states require an
   active JobCore job and required claims under ADR-0018 and the integrated
   architecture. WM-0170 may reserve/release only the prerequisite's narrow
   JobCore token sidecar; it cannot create an active JobCore row, mutate a
   driver or mutate GameSession and therefore cannot prove that invariant.
4. WM-0171 owns the second publication only after the prerequisite driver has
   adopted the already-active B3 claims while creating the real JobCore row:
   expected claiming row/version `r + 1` to `moving` or `working` row/version
   `r + 2`, bind the full pending token as active job identity, clear both
   pending token scalars, bind the exact positive JobCore and driver versions
   plus interruption policy, and preserve the route/claims without a release/
   reacquire gap. WM-0171 never calls a
   historical driver's legacy reserve method for a B3 row.
5. While WM-0170 still has `jobId = NONE`, the current Store policy requires
   `interruptionPolicy = NONE` and `basis.jobVersion = 0`; that zero means “no
   active job row”, not “no reserved token”. B3 therefore treats
   any supposedly inactive Job projection with a job id, policy or non-zero
   version as stale before mutation; it does not fabricate a future binding.

### Strict prerequisites: ledger claim custody and claim-ready driver adoption

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
  claimIndex: number;
  claimId: number;
  releasedCount: number;
  version: number;
  activeCount: number;
}

releaseClaimsInto(
  claimIds: Uint32Array,
  expectedAllocationEpochs: Uint32Array,
  claimCount: number,
  expectedOwner: EntityId,
  expectedJobId: number,
  expectedJobGeneration: number,
  expectedLedgerVersion: number,
  output: ReservationReleaseIntoOutput,
): void;

interface ReservationClaimsIntoOutput {
  ok: boolean;
  reason: ReservationReason | undefined;
  claimIndex: number;
  claimId: number;
  claimCount: number;
  version: number;
  activeCount: number;
  readonly channelCodes: Uint8Array; // exact length 8
  readonly ownerIndexes: Uint32Array; // exact length 8
  readonly ownerGenerations: Uint32Array; // exact length 8
  readonly jobIds: Uint32Array; // exact length 8
  readonly jobGenerations: Uint32Array; // exact length 8
  readonly hasTargetFlags: Uint8Array; // exact length 8
  readonly targetIndexes: Uint32Array; // exact length 8
  readonly targetGenerations: Uint32Array; // exact length 8
  readonly cellIndexes: Uint32Array; // exact length 8
  readonly slotIds: Uint32Array; // exact length 8
  readonly amounts: Uint32Array; // exact length 8
  readonly allocationEpochs: Uint32Array; // exact length 8
  readonly createdTicks: Float64Array; // exact length 8
  readonly leaseExpiryTicks: Float64Array; // exact length 8
}

readActiveClaimsInto(
  claimIds: Uint32Array,
  expectedAllocationEpochs: Uint32Array,
  claimCount: number,
  expectedOwner: EntityId,
  expectedJobId: number,
  expectedJobGeneration: number,
  expectedCurrentLedgerVersion: number,
  output: ReservationClaimsIntoOutput,
): void;
```

The exact accepted names may follow ledger conventions, but both roots belong
to one generic ReservationLedger prerequisite and the reviewed contract must
satisfy all of these mechanical requirements:

`ReservationTransactionRequest` adds optional `jobGeneration?: number` for
source compatibility. Transaction normalization validates it as uint32 and
writes omitted values as required record value `0`; autonomous callers must
supply the positive token generation. Record/view/snapshot/read outputs expose
required `jobGeneration: number` and never preserve “missing” as a third state.

- add an authoritative `allocationEpoch: uint32` lane to every claim record;
  every successful transaction writes its exact post-acquire ledger version to
  all newly allocated claims, so reuse of a freed claim id necessarily receives
  a different positive epoch. `ReservationRecordSnapshot`/view, ledger
  snapshot/restore validation, raw record hashing and the caller-owned read
  output preserve it. Epoch zero is forbidden for an active claim; neither the
  ledger version nor an allocation epoch may wrap. A current version of
  `0xffff_ffff` returns the distinct version-exhausted reason before mutation.
  Restore rejects zero, future, wrapped or malformed active epochs, requires
  every epoch to be no greater than the restored ledger version, and
  reconstructs free ids without changing retained epochs. The prerequisite
  increments the ledger snapshot schema version and rejects old-shape records
  rather than silently synthesizing epochs;
- add `jobGeneration: uint32` to every reservation transaction and claim record,
  with `0` reserved for legacy jobs. Every acquire path, record view/snapshot,
  hash, restore validator, `readActiveClaimsInto`, `releaseClaimsInto` and
  owner/job terminal-cleanup path preserves and validates it. Autonomous claims
  require the positive generation from the exact JobCore token. Legacy callers
  write generation `0`; no broad owner+job-id cleanup may match or release a
  positive-generation claim. This closes job-slot ABA independently of claim-id
  allocation epochs;
- every claim-creating acquire variant requires current
  `ledger.version <= 0xffff_fffd` before any preparation or write, leaving one
  bump for acquire and one for an immediate exact release. Current
  `0xffff_fffe` and `0xffff_ffff` reject all-before-any with
  `reservation_ledger_version_exhausted`. Exact/legacy release and terminal
  cleanup separately require current version below `0xffff_ffff` before their
  one bump. No path wraps a version or emits allocation epoch zero; a retained
  claim that later reaches exhausted global version is structured fatal and
  remains active/non-reusable rather than being broadly cleaned up;

- reset the caller-owned output on every call and allocate no object, array,
  closure or string on the reachable call chain;
- require `claimCount` to be an exact integer in `1..8` and no greater than
  either id/epoch input length; `0`, negative, fractional, greater-than-eight
  and greater-than-input-length counts all return the distinct
  `reservation_claim_count_invalid` reason without reading any id;
- read and release only the first `claimCount` ids. Never read, clear or rewrite
  the input tail. Validate the complete prefix before any mutation with fixed
  index-bounded `O(8^2)` duplicate detection; do not use a temporary Set;
- reject an invalid expected owner/job/generation binding, an expected ledger version that
  does not exactly equal the current version, an exhausted current version,
  `NONE`/out-of-range id, inactive id, duplicate id or a claim whose owner/job/
  generation or allocation epoch differs from the expected binding before
  releasing any claim;
- add exact `ReservationReason` members
  `reservation_claim_count_invalid`, `reservation_claim_duplicate`,
  `reservation_claim_owner_mismatch`, `reservation_claim_job_mismatch`,
  `reservation_claim_job_generation_mismatch`,
  `reservation_claim_epoch_mismatch`,
  `reservation_ledger_version_mismatch` and
  `reservation_ledger_version_exhausted`; retain the existing
  `reservation_claim_id_invalid` and `reservation_claim_not_active` reasons for
  invalid and inactive ids rather than collapsing those cases;
- report the first deterministic offending prefix index and id through
  `claimIndex`/`claimId`. Count, expected-version and version-exhaustion header
  failures set both to `RESERVATION_CLAIM_NONE`; a duplicate reports the later
  duplicate index. On every failure `releasedCount` is zero and `version` and
  `activeCount` are the exact unchanged values observed at call entry;
- on success release exactly the first `claimCount` ids in reverse prefix order.
  This restores the LIFO `freeStack` to its pre-acquire allocation order, so a
  fresh, partially reused or full-capacity ledger returns the same next acquire
  id sequence after acquire-plus-compensation. Update every channel,
  owner/target link, capacity amount, active count, free lane and metric exactly
  once, require `releasedCount === claimCount`, then advance ledger version
  exactly once;
- on failure leave all authoritative claims, counts, links, amounts, free lanes,
  version and release metrics unchanged and return the first deterministic
  offending id/reason in the reused output;
- use index-bounded loops rather than `for-of`, preserve the input/output/typed-
  lane identities, expose the API from the existing package public entry, and
  leave every legacy acquire/release signature and behavior compatible;
- prove every invalid count class; invalid-first/middle/last; inactive;
  duplicate; wrong-owner; wrong-job; wrong-generation; wrong expected version;
  exhausted version;
  and foreign-claim-in-mixed-transaction atomic rejection. Prove exact entity/
  cell/interaction/item/capacity success, output reuse, prefix-only input reads,
  unchanged tail identity/content, version/metric behavior, and fresh/reused/
  full-capacity next-acquire id sequence equality after compensation, plus
  wrong-epoch and recycled-id rejection. Retain
  legacy API compatibility and add a TypeChecker-based allocation-free
  transitive closure.

Boundary tests freeze current versions `0xffff_fffc`, `0xffff_fffd`,
`0xffff_fffe` and `0xffff_ffff`: both lower values may acquire with exact
post-version allocation epochs; only the immediately available legal release
may consume the final bump; both upper values reject acquire atomically; release
at `0xffff_fffe` may reach `0xffff_ffff`; every later mutating call rejects with
unchanged records, indexes, counts and metrics.

`readActiveClaimsInto` applies the same exact integer `1..8`, both input-length,
expected owner/job/generation/epoch, prefix-only and duplicate-before-any
validation as release. Its
`expectedCurrentLedgerVersion` is a freshly sampled batch-consistency input and
must equal the version at call entry; it is not required to equal the older
claiming reservation basis. This permits unrelated ledger mutations while the
durable epoch closes claim-id ABA. The read never mutates the ledger or either
input. It resets every scalar and all fourteen exact-length-eight output lanes
before each call. On success it writes, in input-id order, the active record's
numeric channel, owner, job id/generation, target-present flag and pair, cell,
slot, amount, allocation epoch, created tick and lease-expiry tick, together with the exact
current ledger version and active count. Created/lease outputs are
`Float64Array` Tick lanes, reset to zero and accepted only when `isSafeTick`
holds and lease is not earlier than created tick. A
channel-inapplicable ref is normalized mechanically: `ENTITY`,
`ITEM_QUANTITY`, `INTERACTION_SPOT` and `CAPACITY` carry the exact target pair;
only `CELL` carries `cellIndexes[i]`; `INTERACTION_SPOT` writes its `spotId` to
`slotIds[i]`, `CAPACITY` writes its `capacityId`, and every other slot is
`RESERVATION_CLAIM_NONE`; only `ITEM_QUANTITY`/`CAPACITY` write the requested
amount and every other amount is zero. Output tail `[claimCount, 8)` remains the
same reset sentinel/zero pattern. On failure it reports the first deterministic
offending index/id with a distinct epoch-mismatch reason and leaves
`claimCount = 0`; no partial prefix is accepted as validated. Tests prove
reset/reuse identities, first/middle/last, duplicate and reused-id/wrong-epoch
failures, every channel including interaction spot/capacity slot values, exact
safe Tick/lease fields, prefix ordering, untouched id/epoch input tails, an
unrelated intervening ledger mutation followed by a successful fresh-version
read, and zero ledger/metric mutation.

This prerequisite is a stop line, not an optional optimization. A successful
acquire followed by exact Store validation or publication failure cannot be
safely compensated under the WM-0170 hot-path rules without it.

The expected global version is part of the adjacent B3 compensation guard, not
the durable cross-tick claim identity. Because B3 permits no intervening ledger
operation between acquire and compensation, exact
`expectedLedgerVersion = prior + 1` proves that the acquired prefix is still the
current transaction before release. Across ticks, snapshot/restore and WM-0171
retry, only exact
`(claimId, allocationEpoch, owner, jobId, jobGeneration)` equality closes
claim-id and recycled-job-slot ABA; a historical claiming reservation basis is
never substituted for that tuple.

The ledger surfaces are necessary but not sufficient. The current public owner
APIs cannot mechanically construct all four source claim plans from the exact
facts retained by B2, and the historical drivers all acquire again inside
their legacy reserve step. A Food `stackId`, Medical `stockDefId`/`patientId`,
and an Ordinary WorkOffer `targetId` are owner-local scalar ids, not
`EntityId`s. B3 and WM-0171 must not reinterpret them as entity indexes,
recover claims through a hidden map, or release/reacquire B3 claims merely to
enter a legacy driver.

After Canvas accepts this plan, Beacon creates exactly two prerequisites:

1. one generic ReservationLedger claim-custody task containing both
   `releaseClaimsInto` and `readActiveClaimsInto`; and
2. one cohesive claim-ready owner plus historical-driver-adoption task
   containing the minimum ItemStack/storage/medical/Ordinary-Hauling facts plus
   a construction-extensible Lamp facts surface, JobCore-owned reusable token
   custody and allocation-free JobCore/driver reads, the four concrete adoption
   roots, their exact newly-adopted rollback roots, and generation-aware
   once-only domain/terminal mutation closure for all four drivers.

Both are independently implemented, reviewed, integrated and `done` before
WM-0170 resumes. No prerequisite task is created before Canvas PLAN PASS, and
the second task is not split into uncoordinated per-source/driver tasks.
That prerequisite closes the generic/historical owner and JobCore surfaces.
This plan makes no unproven claim that WM-0171's whole `allowedPaths` needs no
revision; path admissibility is rechecked when its task resumes. Lamp integration
itself must compose the prerequisite public read from existing
`game-session-autonomous-life*.ts` paths and may not reopen the lamp owner or
WM-0170 contracts.

| Source                      | Required prerequisite public facts surface                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Food                        | Add an allocation-free, version-bound exact `stackId -> ItemStack` Into read on the item-stack owner. It returns active status, exact stack id, item `EntityId` index/generation, def id, quantity, reserved quantity, available quantity, capacity, exact stack-row version, item-store version and reservation basis. The Food owner row also owns and returns the positive integer `hungerRestore` for that portion. Both values are retained at final selection and re-read before claim/adoption; `stackId` itself is never treated as an entity. |
| Rest                        | Existing fixture Into/index facts remain sufficient for claims and own `recoveryPerTickQ16`: the selected fixture supplies its real target entity generation, interaction spot, target cell and owner/index versions. `recoveryTargetValue` comes only from the reviewed immutable Rest policy keyed by `restKind`; it is not inferred from the current Need value. No new hidden mapping is permitted.                                                                                                                                                |
| Medical stock               | Add a bounded, deterministic, version-bound exact stock selection/read keyed by the selected request's stock def, region and required amount. It returns a concrete `stockStackId`, item entity index/generation, def id, quantity/available quantity, exact owner version, row version, index version, dirty backlog, item-store version and reservation basis. Selection uses a fixed caller-owned cap and stable stack-id/entity tie-break; it never scans all stacks.                                                                              |
| Medical patient interaction | Add an owner-specific `M3MedicalClaimFactsIndex.readPatientInteractionInto(requestId, output)` (or reviewed equivalent) that returns the exact patient interaction target entity index/generation, spot id, target cell and its source/row/index versions. This derived medical claim-facts owner, not `patientId` or the autonomy provider, owns the request-to-interaction mapping and validates the entity against `EntityRegistry`.                                                                                                                |
| Ordinary Hauling            | Add one construction-approved owner-specific Hauling claim-facts resolver keyed by the exact Hauling policy descriptor, `workType`, WorkOffer id and opaque owner `targetId`. Its allocation-free, version-bound Into output returns the exact four channel facts and owner/row/index versions plus the fixed Hauling job-fact code/value manifest. A WorkOffer `targetId` remains an opaque owner scalar. Every non-Hauling Ordinary descriptor, including Lamp Patrol/Refill, is unmapped in B3 and fails closed before plan access.                 |
| Future Lamp registration    | Add `M4LampNetworkStore.readLampInto(lampId, output)`: allocation-free, version-bound exact read of only the lamp-owned active/id/group/cell/room/chunk/tag/fuel/wick/damage/maintenance/human-claim/shadow-gap fields, owner/lamp versions and dirty backlog. It resets caller output and never fabricates a target `EntityId`, interaction ref, oil-stack ref or job descriptor that the Lamp owner does not own; WM-0170 B3 does not register a Lamp resolver.                                                                                      |

WM-0171 must own any product Lamp claim mapping in a separate fixed typed-lane
`LampClaimFactsIndex` (or reviewed equivalent) under its existing
`game-session-autonomous-life*.ts` ownership. That owner binds lamp id to the
explicit target/interaction facts it registered and combines them with fresh
version-bound ItemStack/storage facts for any oil claim; it has its own
caller-owned Into read, version, bounded dirty/index contract, snapshot and
hash. `M4LampNetworkStore.readLampInto` remains the lamp-state authority and is
one input to that mapping, never a hidden owner of another store's identities.

The same prerequisite adds one combined caller-owned-output adoption root to
each existing driver. The exact accepted method name may follow the store (for
example `createJobAdoptingClaimsInto` or `adoptExistingClaimsInto`), but it is
one operation, not legacy `createJob` followed by a separately fallible adopt:

```ts
interface ExistingClaimsAdoptionControl {
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  expectedJobSlotVersion: number;
  expectedDriverVersion: number;
  claimCount: number;
  readonly claimIds: Uint32Array; // exact length 8
  readonly claimEpochs: Uint32Array; // exact length 8
  claimCreatedTick: Tick;
  adoptionTick: Tick;
  reservationReadVersion: number;
}

interface NewlyAdoptedRollbackControl {
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  expectedAdoptedJobSlotVersion: number;
  expectedAdoptedDriverVersion: number;
  claimingRowVersion: number;
  claimCount: number;
  readonly claimIds: Uint32Array; // exact length 8
  readonly claimEpochs: Uint32Array; // exact length 8
  claimCreatedTick: Tick;
  adoptionTick: Tick;
}
```

Each driver exports `adoptExistingClaimsInto(control, input, jobCore, output)`,
`rollbackNewlyAdoptedInto(control, jobCore, output)` and
`readAdoptedJobInto(jobId, jobGeneration, expectedSlotVersion, output)` under its
public package entry. The concrete type pairs are respectively
`M3EatingClaimAdoptionInput/Output`, `RestClaimAdoptionInput/Output`,
`HaulingClaimAdoptionInput/Output` and `M3TreatmentClaimAdoptionInput/Output`;
they are four fixed caller-reused interfaces, not a runtime union, generic
wrapper or allocated object.

| Driver                   | Exact accepted claim prefix and committed post-adoption state                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M3EatingJobDriverStore` | Two claims in order: Food stack `ITEM_QUANTITY`, then the same entity's `INTERACTION_SPOT`. The input amount, food/stack/storage ids and fresh job facts match. Commit Eating `reserved`, JobCore `running/path_to_source`, zero carried/consumed facts, exact two claim ids and ledger version.                                                                                                                                              |
| `RestJobDriverStore`     | Two claims in order: fixture `ENTITY`, then its `INTERACTION_SPOT`. Fixture/rest kind, actor and recovery job facts match. Commit Rest `pathing_to_fixture`, JobCore `running/path_to_source`, its existing fixture/interaction claim-id lanes and exact ledger version.                                                                                                                                                                      |
| `HaulingJobStore`        | Four claims in order: source `ITEM_QUANTITY`, destination `CAPACITY`, source `INTERACTION_SPOT`, destination `INTERACTION_SPOT`. Source/destination slot ids and requested transfer amount match the fresh resolver; current source quantity/capacity is re-read for validation but never copied as a job fact. Commit Hauling `reserved`, JobCore `running/path_to_source`, zero carried facts, all four claim ids and exact ledger version. |
| `M3TreatmentJobStore`    | Three claims in order: stock `ITEM_QUANTITY`, patient `INTERACTION_SPOT`, treatment `CELL`. Request/patient/condition/treatment/stock/ability facts and immutable treatment policy match. Commit Treatment `reserved`, JobCore `running/path_to_source`, zero progress/delta, all three claim ids and exact ledger version.                                                                                                                   |

Eating and Hauling add exact two/four claim-id and claim-allocation-epoch lanes
plus a reservation-version lane; Treatment adds exact three id/epoch lanes
alongside its existing reservation version. Rest keeps its existing two ids/
version and adds two parallel epochs. All four caller-owned reads, snapshots,
restore validators and terminal/reset paths include those bindings. The three
legacy reserve methods that previously omitted ids write the same new id/epoch
lanes from their successful legacy acquire so adoption and legacy semantics
cannot diverge; legacy failure/terminal cleanup clears ids and epochs with the
same exact tail rules.

All four drivers also add positive `jobGeneration` and current JobCore
`jobSlotVersion` lanes beside `jobId`. Every autonomous create/read/mutate/
terminal path requires the exact owner-affine token; view/snapshot/hash/restore
preserve it and reject cross-generation rows. Legacy generation `0` remains
compatible only outside the configured autonomy range. Retire clears driver
`active` and advances its version without erasing terminal audit evidence.

Every adoption call requires an inactive/unassigned driver slot and the exact
JobCore `RESERVED` token `(pendingJobId, pendingJobGeneration)`; exact expected
driver and pending JobCore slot versions plus a freshly sampled global JobCore
version for bump exhaustion only; the same live resident owner/
generation; the claiming row's exact claim-id/allocation-epoch prefix/count;
and a fresh successful `readActiveClaimsInto` at the current ledger version. It
compares every channel/owner/job/target/cell/slot/amount/allocation-epoch/
created-tick/lease field against the claiming claim facts and the table above
before any mutation. It then calls one new generic
`JobCoreStore.createRunningJobInto` root. Its exact construction mapping is:

| Driver    | JobCore kind / target / interruption / required work                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eating    | kind `3`; target exact source stack id; `at_safe_point`; `0`                                                                                                                                                   |
| Rest      | kind `4`; target exact fixture id; explicit input policy or reviewed `restKind` default; require fresh `recoveryTargetValue > currentRest`, then checked uint32 `(recoveryTargetValue - currentRest) * 65_536` |
| Hauling   | kind `1`; target exact destination slot id; `immediate`; `0`                                                                                                                                                   |
| Treatment | kind `53`; target exact condition id; `at_safe_point`; checked `treatmentTicks * workPerTickQ16`, rejecting overflow rather than truncating/saturating                                                         |

Rest treats `recoveryTargetValue <= currentRest` at the fresh Need gate as the
structured `rest_no_longer_needed` rejection before JobCore/driver mutation. It
never fabricates `requiredWorkQ16 = 1`. Difference and multiplication are
validated as safe integers and checked to fit uint32; `<< 16`, truncation and
saturation are forbidden.

For all four, JobCore `createdTick` equals the claim created tick and claiming
`stateEnteredTick`; `stepEnteredTick` equals the fresh adoption tick. The latter
is a safe Tick not earlier than created tick. Each driver persists those two
separate scalars as claim/job creation and adopted-step entry; no driver aliases
or rewrites creation time to the later adoption tick. The root validates the complete
create input, exact reserved token/slot version and current global exhaustion
gate before any
write, consumes `RESERVED`, then commits status `running`, step
`path_to_source`, zero step ticks/progress/carried facts and exactly one JobCore
version bump. Calling legacy `createJob` with
`initialStep = path_to_source` is explicitly insufficient because it leaves
status `ready`; calling `enterStep` afterward would add a second fallible
mutation. After atomic running creation, the combined root performs only
non-failing typed-lane writes for driver state and claim binding. No
adoption path calls `acquire`, `acquireInto`, a legacy reserve method, broad
cleanup or any release. Legacy create/reserve behavior remains compatible
outside the configured autonomy range.

The prerequisite changes JobCore `createdTick`/`stepEnteredTick` and Eating,
Hauling and Treatment persisted created/step-entered lanes to `Float64Array`;
Rest keeps its existing Float64 Tick lanes under the same validator. Every
create/adopt/read/mutate/rollback/terminal/snapshot/hash/restore path requires
`isSafeTick`, preserves values above uint32 without narrowing, and rejects an
unsafe, fractional, negative or time-reversed Tick before mutation. No `Uint32`
cast, bitwise operation, saturation or wall-clock source is accepted.

The common caller-reused adoption envelope contains the exact owner-affine
token, claim ids, allocation epochs and count, claim-created/adoption ticks,
fresh ledger read version, and expected JobCore-slot/driver versions; its driver-
specific input contains every scalar named by the matching current create/view
schema. The caller-reused output resets before every call and returns `ok`, exact
reason, full token, JobCore/driver versions, both active counts, JobCore running/
reserved/current-tombstone/cumulative-terminal counts, and the complete
post-call driver current metrics and cumulative counters.
Before adoption, the expected JobCore slot and driver versions must be at most
`0xffff_fffd`,
reserving one bump for adoption and one for guarded rollback. Distinct
`job_core_version_exhausted` and driver-specific `*_version_exhausted` reasons
reject all-before-any; the freshly sampled global JobCore version must likewise
be at most `0xffff_fffd`. Success slot/driver versions must equal both predicted
`prior + 1` values; a successful later rollback must equal both `prior + 2`
values. The returned global JobCore version is truthful but is not compared to
the older claiming row after unrelated slot mutations.

The prerequisite also adds a version/state-guarded
`rollbackNewlyAdopted...Into` for each driver plus the minimum JobCore rollback
primitive it needs. It accepts only the exact row just created by that adoption:
same full token/owner, driver and JobCore `prior + 1` versions,
`running/path_to_source`, zero step ticks/progress/carried state, exact created/
step-entered ticks, exact claim id/epoch binding and no later driver mutation.
The combined root prevalidates the complete driver row and JobCore row first,
then calls the still-fallible JobCore rollback with the exact expected version.
Only its success converts the active JobCore row back to the same owner-affine
`RESERVED` token and bumps JobCore to `prior + 2`; the remaining driver clear is
a reviewed non-failing typed-lane write that bumps the driver to `prior + 2`.
Active counts return to their pre-adoption values, complete cumulative/terminal
metrics remain unchanged, no terminal outcome is recorded, and the ledger is
never read, released or otherwise mutated. The caller-owned rollback output is
reset/reused and reports complete token, versions, counts and unchanged metrics.
Version/state mismatch returns a structured failure with both owners and all
claims unchanged. Tests inject
every precommit rejection and an autonomy publication failure after successful
adoption, prove no partial driver/JobCore rollback, and audit the post-validation
write closure for no fallible call.

Post-adoption proof is allocation-free. The prerequisite adds
`JobCoreStore.readJobInto(jobId, jobGeneration, owner, expectedSlotVersion,
output)`; its reusable
output contains found/reason, full token, owner, job kind, target, status, step,
interruption/failure codes, created/step-entered ticks, step tick count,
progress/required work, carried def/amount, Store version and active/running/
reserved/current-tombstone/cumulative-terminal/backlog counts plus the exact
slot version. It resets all scalars on
every call and validates the active-row generation and expected slot version;
WM-0171 never calls materializing `readJob` or constructs a `JobRecordView`.

Each driver similarly adds one exact generation-aware caller-owned
`readAdoptedJobInto` root. Its output mirrors every committed scalar in the
current driver view/create schema, adds the full token, exact claim-id/epoch
bindings and reservation version, includes driver Store version/active count and
every current driver metric/cumulative counter, and resets source-inapplicable
fields/tails. Concretely, Eating includes source/storage/food/amount/hunger and
all item/availability/meal/ability, created/step, carried/consumed and terminal
fields; Rest includes actor/fixture/kind/target cell/spot/schedule/environment/
need, recovery, created/step and terminal fields; Hauling includes source/
destination/amount, created/step and carried fields; Treatment includes every
caregiver/request/stock/patient/condition/treatment/ability/basis, progress/
delta/step/terminal field. Adoption and rollback outputs plus these five Into
reads are the only accepted committed-state proof surfaces.

The second prerequisite increments—not reuses—each snapshot schema whose
authoritative layout changes: at minimum ReservationLedger, JobCore,
`M3EatingJobDriverStore`, `RestJobDriverStore`, `HaulingJobStore` and
`M3TreatmentJobStore`; WM-0170 separately increments the
ResidentAutonomyStore raw snapshot schema. Any new or extended claim-facts owner
with authoritative lanes receives its own explicit snapshot version. The
read-only `M4LampNetworkStore.readLampInto` projects existing Lamp lanes and
does not by itself justify adding foreign identities or bumping the Lamp
snapshot. Each changed restore rejects the prior shape
instead of synthesizing defaults. Canonical hash, snapshot records, restore
validation and allocation-free reads include every new job generation,
allocation epoch, per-slot version, reserved owner/origin state, tombstone/audit
shadow, claim id/epoch prefix, created/step Tick and effect-phase/once-only flag.
The WM-0171-owned Lamp claim-facts index separately hashes and snapshots only
the mapping it owns. Cross-store fixtures restore all changed schemas together
and reject any mixed old
shape, token/row generation mismatch, missing epoch, bad slot version, lost
tombstone shadow or effect-phase contradiction.

Each facts/adoption/rollback surface resets caller-owned output, preserves
output/ref/typed-lane identity, exposes exact stale/empty/malformed reasons, and
is included in a receiver-exact TypeChecker closure. Food/Medical/Ordinary
success outputs and the four adoption roots are not present in the passed
`59c9731` B2 checkpoint. After both prerequisites are integrated, B3 first
extends the B2 final-selected read-only step to call the facts/policy surfaces
once and retain the exact claim and job schemas frozen below. It does not claim
that the historical checkpoint already retained them. The later B3 pre-acquire
phase re-reads the same surfaces and compares every retained scalar and every
`AutonomyVersionBasis`/policy version before plan access. These final-selected
bounded reads do not expand the 24 visited / 12 scored / 4 exact-path caps or
authorize a global scan. WM-0170 does not call the adoption roots; WM-0171 does
so only after the claiming row exists.

### Exact B3 resume procedure after prerequisite integration

1. Confirm Canvas plan PASS, exactly the ledger claim-custody and cohesive
   claim-ready-owner/driver-adoption prerequisite tasks independently `done`, both
   integrations reachable from current `main`, clean single worktree, and
   WM-0170 still owned by Tally/in progress. Run workflow validation/status; do
   not reclaim or complete the task.
2. Rebase or otherwise refresh the existing WM-0170 branch only through the
   project workflow chosen by Beacon, then rerun the B2 focused suite,
   typecheck and closure audit unchanged. Stop on any baseline regression. The
   first B3 implementation checkpoint then adds the final-selected claim-facts
   reads/retention defined here and proves them before enabling any acquire.
3. Re-read the integrated `releaseClaimsInto`/`readActiveClaimsInto`, exact
   ItemStack/Food job-fact read, Rest policy, Medical stock/patient-interaction
   facts and immutable treatment policy, concrete Hauling resolver, Lamp Into
   facts, JobCore token/Float64 Tick surfaces, all four adoption/rollback and
   once-only driver/domain/terminal roots and their public exports/tests/reviews.
   Verify actual signatures against this contract and add every concrete B3
   receiver to the TypeChecker closure before editing coordinator production
   code.
4. Implement B3 only in the already-approved autonomy selection/types/store
   modules and focused autonomy test/report unless Canvas explicitly approves a
   narrower revised file list. Do not modify ReservationLedger again inside
   WM-0170.
5. Execute the ordered revalidation, plan, prevalidation, acquire, exact
   publication and compensation sequence below; run the complete B3 matrix and
   scoped gates; update the report; push a B3 checkpoint and stop for independent
   Canvas implementation review. Do not run `taskctl complete` until that review
   passes.
6. WM-0171 starts only after WM-0170's normal final review/integration. Its
   first claiming-handoff fixture must prove prevalidated claiming-to-moving
   shape, combined create/adopt, exactly-once guarded rollback and conditional-
   headroom retained-claim retry behavior
   for Eating, Rest, Hauling and Treatment before any full-day integration is
   allowed to treat a claiming row as an active job.

### Frozen claim-plan inputs and field ownership

`AutonomyClaimPlanSource.readPlanInto` is extended rather than supplied with a
mutable request object. Its exact scalar inputs are frozen as:

```ts
readPlanInto(
  candidateSourceCode: AutonomyCandidateSourceCode,
  candidateId: number,
  targetId: number,
  targetCellIndex: number,
  residentIndex: number,
  residentGeneration: number,
  pendingJobId: number,
  pendingJobGeneration: number,
  pendingJobSlotVersion: number,
  tick: Tick,
  leaseExpiryTick: Tick,
  claimFacts: AutonomyClaimFactsInput,
  jobFacts: AutonomyJobFacts,
  output: AutonomyClaimPlanIntoOutput,
): void;
```

The coordinator owns the eleven scalar values. It passes the B2-selected
source/candidate/target/cell and exact request resident/tick. A construction-only
policy supplies one fixed positive integer lease duration. The coordinator uses
a checked safe-add (`tick + leaseDurationTicks`) and calls no provider when the
duration, tick or sum is not a safe Tick; saturation, wraparound and provider-
chosen wall time are forbidden. No provider may read a hidden mutable
resident, tick, lease, selected-candidate or sequence context.

`pendingJobId`/`pendingJobGeneration` come only from JobCore-owned, owner-affine
reusable token custody added by the second prerequisite. Its frozen caller-owned
surface is:

```ts
interface JobTokenIntoOutput {
  ok: boolean;
  found: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  stateCode: number;
  originStateCode: number;
  slotVersion: number;
  version: number;
  reservedCount: number;
  activeCount: number;
  runningCount: number;
  currentTombstoneCount: number;
  cumulativeTerminalCount: number;
}

reserveAutonomyJobTokenInto(
  expectedJobCoreVersion: number,
  owner: EntityId,
  output: JobTokenIntoOutput,
): void;

releaseReservedAutonomyJobTokenInto(
  jobId: number,
  jobGeneration: number,
  owner: EntityId,
  expectedJobSlotVersion: number,
  output: JobTokenIntoOutput,
): void;

readAutonomyJobTokenInto(
  jobId: number,
  jobGeneration: number,
  owner: EntityId,
  expectedJobSlotVersion: number,
  output: JobTokenIntoOutput,
): void;

readAutonomyJobTokenForOwnerInto(
  owner: EntityId,
  output: JobTokenIntoOutput,
): void;
```

Construction explicitly configures one contiguous autonomy-token range within
`JobCoreStore.capacity`; its default start excludes legacy id `0`. With that
range configured, every legacy id-only create/read/mutate/terminal root rejects
an id in the range. Historical construction with no autonomy range preserves
legacy behavior. Reservation chooses the lowest deterministic reusable slot in
the configured range, binds the exact owner, and increments that slot's uint32
generation counter before publishing `RESERVED`. Generation `0` is legacy-only;
counter exhaustion returns `job_token_generation_exhausted` before mutation and
the counter never wraps. No ResidentAutonomyStore ordinal, stripe or hidden
allocator exists.

Before choosing a slot, reserve performs one bounded stable-ascending scan of
only the configured autonomy range for the exact owner. Any existing
owner-affine `RESERVED` or `RUNNING` token returns distinct
`job_token_owner_busy` all-before-any; two matches are a structured invariant
breach. `readAutonomyJobTokenForOwnerInto` exposes the same allocation-free
owner-to-token lookup for recovery. Consequently one resident can never hold a
second token, and a token-release failure remains discoverable by owner even if
the caller lost its immediate output. Owner lookup resets/reuses output, returns
zero-or-one exact token plus slot state/version, and never scans outside the
bounded range.

JobCore owns fixed sidecar lanes for slot generation, reserved flag/token owner,
reserved-origin state, per-slot version, active-row generation and inactive
terminal-tombstone generation. Reserve is
legal only for `FREE` or a reusable inactive terminal tombstone with no reserved
token; it advances both slot and global JobCore versions exactly once. Exact
release requires the
complete `(jobId, jobGeneration, owner)` token plus its expected slot version,
clears only `RESERVED`, burns rather than decrements the generation, and advances
both slot and global JobCore versions exactly once. Snapshot schema, restore
validation and canonical hash include every counter, slot version, reserved
flag/owner/origin, row/tombstone generation and the deterministic reusable ordering;
restore rejects cross-generation, dual-state or out-of-range ownership. Reads,
release, adoption and rollback validate the slot version, not a historical
global Store version, so unrelated JobCore mutations do not invalidate a token.
Every token/adoption/rollback/autonomous driver/domain/terminal root preflights
every version it will bump and returns its distinct exhaustion reason before
mutation; neither global, slot nor driver versions wrap.

The token state machine is exact: `FREE/TOMBSTONE -> RESERVED` increments
generation, slot version and global JobCore version; a B3 abort performs
`RESERVED -> original FREE/TOMBSTONE`, preserves the burned generation, and
increments both versions; combined adoption performs `RESERVED -> RUNNING` plus
driver activation with one slot/global and one driver version bump; guarded
rollback permits only the just-adopted zero-step/progress/carried row while
autonomy is still claiming, and performs `RUNNING -> RESERVED` plus driver clear
with one bump per owner. Normal terminal performs `RUNNING -> TOMBSTONE`, driver
`active = 0`/retired and active-count decrement only after exact same-generation
claim cleanup succeeds, again with one bump per owner.

Reserving from `TOMBSTONE` copies its minimum audit payload—terminal token/
owner, kind, target, status/reason, created/terminal ticks and effect phase—into
a fixed origin shadow. The visible slot may become `RESERVED`/`RUNNING`, but the
shadow remains current audit evidence until abort restores it or a later
successful terminal atomically replaces it; reserve never discards an old
tombstone. Counts use these exact deltas:

| Transition                      | reserved | active | running | current tombstone                                | cumulative terminal |
| ------------------------------- | -------- | ------ | ------- | ------------------------------------------------ | ------------------- |
| `FREE/TOMBSTONE -> RESERVED`    | `+1`     | `0`    | `0`     | `0` (origin tombstone remains shadow-counted)    | `0`                 |
| abort to original state         | `-1`     | `0`    | `0`     | `0`                                              | `0`                 |
| `RESERVED -> RUNNING` adoption  | `-1`     | `+1`   | `+1`    | `0`                                              | `0`                 |
| `RUNNING -> RESERVED` rollback  | `+1`     | `-1`   | `-1`    | `0`                                              | `0`                 |
| `RUNNING -> TOMBSTONE` terminal | `0`      | `-1`   | `-1`    | `+1` from FREE origin, `0` when replacing shadow | `+1`                |

Outputs and metrics name `reservedCount`, `activeCount`, `runningCount`,
`currentTombstoneCount` and `cumulativeTerminalCount` explicitly; “terminal
count” alone is forbidden. Each driver likewise distinguishes current active/
step counts from cumulative completed/canceled/failed counters, mirrors its
adoption/rollback/retire deltas, and preserves the origin audit needed to undo a
new adoption without rewriting cumulative metrics.

Terminal coordination first prevalidates every driver/JobCore/owner/autonomy
row, exact token/claim epoch prefix, release output capacity and final terminal
publication. It then performs exact same-token claim release; after that first
fallible mutation, only driver retire, JobCore tombstone and autonomy terminal
publication remain as reviewed non-failing typed-lane commits. Every domain
effect or compensation must already be atomically committed and phase-marked
before release; no domain owner is mutated afterward. No fallible call or
broad owner/job cleanup is permitted after release. A release/prevalidation
failure leaves the row non-reusable with a structured reason. Tombstones do not
count toward `activeCount` or the 100,000-tick zero-active invariant; terminal
audit, generation and slot version remain durable. A later reserve may reuse the
same id only with a new generation. All autonomous JobCore/driver mutations
validate the full token; legacy id-only roots can never reach this range.

The second prerequisite covers every autonomous mutation root, not only claim
cleanup: every start-pathing/begin-interaction transition; Eating pickup/
consume/cancel/fail/interrupt/complete; Rest recovery tick/cancel/fail/
interrupt/complete; Hauling pickup/deliver/carried-return/cancel/fail/interrupt/
complete; and Treatment progress/treat/cancel/fail/interrupt/complete. Every call accepts the full owner-affine token and exact expected slot
and driver versions plus a safe Tick through caller-owned Into inputs. Each
driver persists numeric `effectPhase`, `cleanupPending`, `pendingOutcome` and
Float64 `lastEffectTick` plus operation-specific once-only flags. Those lanes are
returned by Into reads and included in snapshot/hash/restore. Once
`cleanupPending = 1`, every ordinary mutate root rejects and only
`resumeCleanupInto` for the same token/outcome may run.

| Driver    | Frozen once-only phase path                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eating    | pickup atomically removes item amount into carried/interact; a later pickup failure uses one add-back/compensation phase. consume applies Hunger once, records `NEED_APPLIED`, then records consumed/clears carried before cleanup. cancel/fail/interrupt after pickup returns carried food once as `RETURNED`, then cleanup.               |
| Rest      | begin enters driver interaction without a second JobCore `enterStep`. Each tick atomically couples Need delta with JobCore/driver progress and records `lastEffectTick`; duplicate tick rejects/compensates without another delta. Reaching target fixes pending outcome `COMPLETE`; release failure forbids further ticks.                 |
| Hauling   | pickup removes source once and records `CARRIED`; deliver adds destination once, records `DELIVERED` and clears carried before cleanup. cancel/fail/interrupt returns source once as `RETURNED`, then cleanup.                                                                                                                              |
| Treatment | start-pathing changes only driver `reserved -> pathing` because JobCore already is `path_to_source`; it never calls `enterStep`. Begin enters interaction; progress is guarded by `lastEffectTick`. Complete applies health once as `HEALTH_APPLIED`, then stock once as `STOCK_CONSUMED`, then cleanup; pending resumes only that outcome. |

Each domain mutation either uses one caller-owned atomic Into root or performs
complete owner/version/capacity preflight followed by a TypeChecker-proven
non-failing typed commit/compensation closure. Eating jointly guards ItemStack,
Need and carried state; Rest jointly guards tick progress and Need; Hauling
guards source/destination ItemStack plus carried return/delivery; Treatment
guards stock and HealthCondition. The effect flag advances in the same atomic
commit as its domain change. A repeated call that finds the effect already
committed never repeats it and moves only to explicit
`TERMINAL_CLEANUP_PENDING` when cleanup remains.

Terminal cleanup first atomically completes and phase-marks any still-required
domain effect or compensation, then prevalidates every owner version,
driver/JobCore/autonomy terminal row and the exact release. A
release failure keeps `TERMINAL_CLEANUP_PENDING`, the token non-reusable and all
once-only flags intact; subsequent calls may retry cleanup only and cannot
pickup, consume, recover, deliver, treat or compensate again. After exact
same-generation claim release succeeds, only driver retire, JobCore tombstone
and autonomy terminal publication remain as non-failing typed commits. Failure
injection covers every owner preflight,
domain commit, release and post-release boundary and proves no duplicate Need,
item, carried, recovery, stock or health effect.

B3 reserves once in stable resident-decision order and persists the exact token
and reserved slot version in the claiming row, and persists id/generation in
every claim transaction. The provider only echoes the
explicit token scalars into its header/transaction; it has no sequence
source. Tests prove two-resident ordering, range/capacity exhaustion, legacy
range rejection, generation exhaustion/non-reuse, reserve/release version
deltas, terminal reuse, owner mismatch/owner-busy, release-failure owner lookup
and snapshot/hash/restore roundtrip. Exact boundary fixtures cover
`0xffff_fffc`, `0xffff_fffd`, `0xffff_fffe` and `0xffff_ffff`: B3 accepts only
global/slot pre-reserve values through `fffc`; WM-0171 accepts fresh global/
slot/driver values through `fffd`; adoption and guarded rollback may truthfully
consume `fffe` then `ffff`; each higher entry rejects before mutation and no
counter wraps.

`claimFacts` is a fixed construction-owned caller scratch whose identity never
changes. This plan freezes its complete schema; `AutonomyClaimFactsLanes` uses
the same fields in Store-owned scalar/flattened typed lanes and is not an object
reference:

```ts
const AUTONOMY_CLAIM_FACT_SLOT_COUNT = 8;

interface AutonomyClaimFactsInput {
  sourceCode: AutonomyCandidateSourceCode;
  resolverKind: number;
  channelCount: number;
  ownerCandidateId: number;
  ownerTargetId: number;
  primaryStackId: number;
  secondaryStackId: number;
  primaryDefId: number;
  primaryAmount: number;
  medicalRequestId: number;
  medicalPatientId: number;
  medicalConditionId: number;
  medicalTreatmentDefId: number;
  transitionTargetSlot: number;
  claimLeaseExpiryTick: Tick;
  readonly channelCodes: Uint8Array; // exact length 8
  readonly targetIndexes: Uint32Array; // exact length 8
  readonly targetGenerations: Uint32Array; // exact length 8
  readonly cellIndexes: Uint32Array; // exact length 8
  readonly slotIds: Uint32Array; // exact length 8
  readonly amounts: Uint32Array; // exact length 8
  readonly limits: Uint32Array; // exact length 8
  readonly domainIds: Uint32Array; // exact length 8
}
```

`sourceCode`, `resolverKind`, `channelCount` and the twelve remaining scalar
fields are copied directly into fixed Store lanes; every eight-entry array is
copied into a resident-offset fixed lane. `channelCount` is exactly `1..8` for a
claiming row. For every unused slot `[channelCount, 8)`, `channelCodes` is
`CLAIM_CHANNEL_NONE`, target index/generation, cell, slot and domain id are
`AUTONOMY_REF_NONE`, and amount/limit are zero. Within the active prefix, a
non-applicable target pair/cell/slot/domain uses `NONE`; a non-applicable
amount/limit uses zero. Every source-inapplicable scalar id uses `NONE` and
`primaryAmount` uses zero. Owner/row/index/item/reservation versions remain in
`AutonomyVersionBasis` and are not duplicated in claim-facts lanes.

`limits[i]` has one channel-exact meaning. `ITEM_QUANTITY` stores the owner
stack's total physical quantity, exactly the `availableAmount` limit passed to
ReservationLedger before it adds existing reserved aggregates;
`CAPACITY` stores the owner's current reservable physical limit (for storage,
physical capacity minus current stored quantity), exactly the request
`capacity` passed to the ledger. It is not post-claim available supply or
`availableCapacity`. `ENTITY`, `CELL` and `INTERACTION_SPOT` use zero. B3 proves
the pre-acquire aggregate plus requested/pending amount fits that total/physical
limit. During WM-0171 adoption the fresh owner read must preserve total stack
quantity or physical limit and report a current reserved aggregate containing
the row's own active claim amount. Post-acquire available/remaining values are
expected to change and are never compared directly to their B3 pre-acquire
values.

`transitionTargetSlot` is either `AUTONOMY_REF_NONE` or one exact index in the
active prefix. A non-`NONE` value requires that slot to carry a channel-required
non-`NONE` target entity pair; that pair is the only legal claiming transition
and `RESERVATION_ACQUIRED` reason target. `NONE` requires both transition and
reason targets to be `NONE/NONE`. Store validation never chooses the first or
an "optional" entity from another slot.

`claimLeaseExpiryTick` is a Store-owned `Float64Array` Tick lane and the exact
checked lease passed to the transaction.
The claim created tick is not duplicated: it must equal the claiming
`stateEnteredTick`/request tick. Transition/read/raw snapshot preserve the lease
scalar, and WM-0171 compares every active claim's created/lease ticks to those
two stored values rather than recomputing a lease from policy.

The Store claim-id lane adds a parallel fixed `Uint32Array claimEpochs` of exact
length eight to transition/read/raw snapshot. On B3 success every active prefix
entry is the trusted successful transaction epoch `priorLedgerVersion + 1`,
paired positionally with `claimIds[i]`; tail ids are `NONE` and tail epochs are
zero. Store validation rejects a zero active epoch, non-zero tail, id/epoch
count mismatch or snapshot cross-pairing. The epoch, not a later global ledger
version, is the durable claim-incarnation basis used by WM-0171.

Autonomy Store adds positive `pendingJobGeneration` and
`pendingJobSlotVersion` lanes beside `pendingJobId`, plus an active
`jobGeneration` lane beside `jobId`. Claiming publication copies the complete
reserved token and slot version; claiming-to-moving/working copies id/generation
to the active lanes and clears all pending-token lanes. Structured reason and
version-basis outputs, `readStateInto`, transition validation/publication, raw
snapshot/restore and hashing preserve and cross-validate the generation; the
claiming reason carries it as an exact numeric parameter rather than relying on
prose. Terminal autonomy rows retain the completed token generation for audit.
A zero positive-generation lane, mismatched pending/active pair, missing slot
version, bad cleared tail or snapshot cross-pair is rejected. Unrelated global
JobCore Store changes do not invalidate the persisted per-slot version.

Structured-reason numeric parameters remain `Int32Array` lanes. A uint32
`jobGeneration` is written as its exact 32-bit pattern, read/compared with
`parameter >>> 0`, and round-trips through read/snapshot/restore/hash without
signed numeric equality or truncation. This applies to claiming, moving/working,
terminal and fatal token/version reasons.

The current tick-local `AutonomyJobFactsLane` remains the JobCore decision
projection. The durable claiming handoff adds a distinct fixed
`AutonomyJobFacts` bundle to claim scratch, Store transition/read lanes and raw
snapshot/restore:

```ts
const AUTONOMY_JOB_FACT_SLOT_COUNT = 8;

interface AutonomyJobFacts {
  policyKind: number;
  policyVersion: number;
  factCount: number;
  readonly factCodes: Uint8Array; // exact length 8
  readonly factValues: Int32Array; // exact length 8, uint32 values use exact bits
}
```

`factCount` is the exact construction-reviewed count in `1..8`. Active codes
are non-`NONE` and unique for the selected resolver; unused codes and values in
`[factCount, 8)` are exactly zero. Unsigned integer facts are stored as their
exact 32-bit bit pattern and decoded with unsigned semantics; no float,
truncation or prose is permitted. `policyKind = NONE/policyVersion = 0` is
legal only for the Food owner-only row. Every other row names one immutable,
construction-reviewed policy/descriptor receiver and its positive manifest
version. The receiver is copied/validated at construction, has no mutable
runtime context and is enumerated in the TypeChecker dynamic receiver table.

| Source/resolver  | Exact ordered job facts and authority                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Food             | Count 1: `FOOD_HUNGER_RESTORE`. The value is owned by the fresh Food portion row added by the prerequisite, retained with the final selection, and re-read both before B3 acquire and WM-0171 adoption. It is not derived from `foodDefId`, need urgency or current stack quantity.                                                                         |
| Rest             | Count 2: `REST_RECOVERY_TARGET_VALUE`, `REST_RECOVERY_PER_TICK_Q16`. Target value comes from the immutable Rest recovery policy keyed by exact `restKind` and policy version; per-tick Q16 comes from the fresh fixture owner row. Both are retained and re-read/re-resolved. Current Rest Need is validation input only and is never copied as the target. |
| Medical          | Count 3: `TREATMENT_TICKS`, `TREATMENT_WORK_PER_TICK_Q16`, `TREATMENT_SEVERITY_DELTA`. All three come from one immutable treatment policy keyed by fresh `treatmentDefId`; exact treatment policy kind/version and receiver closure are construction-reviewed. Neither the medical provider nor WM-0171 may read hidden mutable tuning context.             |
| Ordinary Hauling | Count 1: `HAUL_TRANSFER_AMOUNT`, equal to the exact resolver-requested/claimed transfer amount. Source and destination slot ids remain the reviewed claim/domain scalars. Fresh source quantity and destination remaining capacity are revalidation/claim limits only and are never copied into job facts.                                                  |

The fixed eight-slot `AutonomyClaimFacts`/`AutonomyJobFacts` schema is
construction-extensible through a validated descriptor registry; adding a
descriptor never changes these WM-0170 types or Store lanes. WM-0170 B3
construction registers only Hauling as an Ordinary resolver. Its descriptor row
literally lists resolver kind, exact code prefix, value
source, policy kind/version and target-slot rule; `(workType, defId)` alone is
not a dispatch body. An unknown or non-Hauling descriptor—including Lamp Patrol
or Lamp Refill—reordered/duplicate code, extra fact, policy version mismatch or
dynamic owner value substituted for immutable policy data fails before plan
access with zero acquire calls. The provider echoes the exact bundle but cannot
derive or alter it. Store transition, read and snapshot validation bind it to
the selected source/resolver and reject tail residue/cross-source codes.

Lamp work is not silently mapped to Hauling and the four historical adoption
roots do not cover it. The prerequisite already exposes version-bound
`M4LampNetworkStore.readLampInto`; WM-0171 may register a real Lamp descriptor,
provider, typed Lamp claim-facts owner, driver and adoption/rollback roots inside
existing `game-session-autonomous-life*.ts`, combining the Lamp read with the
separately owned interaction and oil/storage facts. It then extends its own
receiver closure without editing WM-0170 or the Lamp owner. Until that
construction registration exists, Lamp returns the structured
unmapped-descriptor result before plan access and performs zero plan and zero
acquire calls.

`AutonomyJobFacts` contains only driver construction inputs. It never stores a
current ItemStack quantity, available quantity, remaining capacity, current
Need value or other mutable owner total. Claim limits remain bounded
reservation-validation facts and are re-read from their owner before adoption;
WM-0171 cannot use them as driver job inputs.

The exact fields merged additively into the existing `AutonomyVersionBasis` are
frozen as:

```ts
interface AutonomyVersionBasisAdditions {
  wakeEventVersion: number;
  driverVersion: number;
  jobGeneration: number;
  jobSlotVersion: number;
  claimPrimaryOwnerVersion: number;
  claimPrimaryRowVersion: number;
  claimPrimaryIndexVersion: number;
  claimPrimaryBacklog: number;
  claimSecondaryOwnerVersion: number;
  claimSecondaryRowVersion: number;
  claimSecondaryIndexVersion: number;
  claimSecondaryBacklog: number;
  claimItemStoreVersion: number;
  claimReservationVersion: number;
}
```

| Source           | Exact claim-basis mapping                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Food             | Primary is the exact ItemStack owner/read row: owner = item-store version, row = prerequisite stack-row version, index/backlog = `0`; secondary is all `0`; item-store and reservation fields equal the exact ItemStack/availability read bases. Existing Food candidate owner/index/item lanes remain unchanged.                                               |
| Rest             | All new claim-primary/secondary/item/reservation fields are `0`; the existing Rest source/store/current/cached-row/index/backlog lanes and common reservation version remain authoritative.                                                                                                                                                                     |
| Medical          | Primary is the bounded stock selector/read owner, row, index and backlog; secondary is the patient-interaction claim-facts owner, row, index and backlog; item-store and reservation fields equal the exact selected stock availability bases.                                                                                                                  |
| Ordinary Hauling | The static Hauling descriptor assigns the exact source/destination owner/read/index/backlog bases to primary and secondary. Item-store and reservation fields equal the exact item/availability bases required by its four active claim slots. Any non-Hauling descriptor or more than two claim-owner groups requires plan re-review rather than hidden reuse. |

`wakeEventVersion` is the exact selected wake-event owner version for every
source. Generic `candidateOwnerVersion`, `candidateRowVersion` and
`candidateIndexVersion` continue to bind the original Food/Rest/Medical/
WorkOffer selection owner only; they cannot be reused to hide ItemStack,
Medical claim-facts or Ordinary resolver versions. Every non-zero
`claimReservationVersion` must equal the common `reservationVersion`. For Food,
`claimPrimaryOwnerVersion` must equal `claimItemStoreVersion`; Medical and
Ordinary bind `claimItemStoreVersion` through their reviewed resolver mapping,
and Store validation rejects any contradictory version tuple.

`driverVersion` is `0` in WM-0170's claiming row because no historical driver
exists yet. In claiming, basis `jobGeneration/jobSlotVersion` equal the pending
token; after adoption they equal the active token/current slot. WM-0171 may set
`driverVersion` only to the positive exact post-adoption driver
store version returned by the combined root, alongside the exact positive
JobCore mutation `jobVersion`. The slot version, not an older global version,
is the concurrency guard; predicted slot/driver values and exact returned/Into-
read values are validated before final autonomy publication.

The scratch is not an authority and does not allocate. Every field must exactly
equal the retained post-prerequisite B2 facts and the immediately preceding B3
fresh reads. The provider receives it explicitly; construction-time mutable
side channels are forbidden.

The provider resets the existing output in place, echoes the four selection
scalars into the header, writes the explicit resident index/generation into the
fixed transaction owner, writes the explicit Store-derived `pendingJobId`
and `pendingJobGeneration` identically to header and transaction, echoes the
pending slot version in the header, writes the supplied tick/lease expiry,
and binds only the fixed source-required claim slots from `claimFacts`. It must
not query an injected hidden mapping/sequence or turn an owner-local scalar into
an entity. It may emit an entity/item/interaction/capacity ref only when that
channel requires the corresponding non-`NONE` EntityId in `claimFacts`; cell
claims require no entity target. It may not choose a different candidate,
target scalar, resident, pending token/slot version, tick or lease and may not rewrite either
fixed facts bundle. `jobFacts` is explicit read-only handoff input, never hidden
provider policy. The coordinator,
not the provider, owns all alias, channel/source-required EntityRegistry
generation, source-row, count, route, version and transition validation and
remains responsible for acquire/compensation/publication.

The validated `claimFacts` and `jobFacts` are a durable WM-0171 handoff, not
temporary provider scratch. B3 extends the already-approved autonomy
types/store and raw snapshot with fixed scalar/flattened
`AutonomyClaimFactsLanes` and `AutonomyJobFactsLanes` bundles. The claiming
transition copies both exact validated bundles before publication. Store
transition/raw-snapshot validation rejects wrong source/resolver/policy
discriminators, missing channel/job-required fields, stale cross-source
residue, invalid EntityId pairs, counts above fixed capacities, a wrong
`transitionTargetSlot`, target/reason mismatch or any claim/job/basis mismatch.
Snapshot round-trip preserves every scalar, code, value and tail. No object,
provider/policy reference, owner row or claim object is stored. The
prerequisite outputs, B2 retained scratch, B3 fresh scratch, provider input,
claiming transition/read output and raw snapshot use this exact manifest. A
prerequisite/provider may not append an unreviewed field, variable-length
payload or source-private object; any newly discovered construction fact
returns this plan to review instead of being hidden in context.

| Source           | Exact scalar and active-slot mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Food             | `resolverKind = FOOD`; candidate/target echo the selected owner scalars; `primaryStackId = candidateId`, secondary stack and all medical ids are `NONE`, primary def/amount are the selected food def/requested portion. Slot 0 is `ITEM_QUANTITY` with the ItemStack entity pair, amount, total stack-quantity limit and `domainId = primaryStackId`. Slot 1 is `INTERACTION_SPOT` with the same ItemStack entity pair, selected spot id and `domainId = storageSlotId`. `transitionTargetSlot = 0`; job facts are the exact Food row above.                                                                                                                                             |
| Rest             | `resolverKind = REST`; owner candidate/target are the fixture scalars; both stack ids and all medical ids are `NONE`; `primaryDefId = restKind`, amount zero. Slot 0 is `ENTITY` for the fixture entity with `domainId = fixtureId`. Slot 1 is `INTERACTION_SPOT` for that same entity/spot with `domainId = fixtureId`. `transitionTargetSlot = 0`; job facts are the exact Rest row above.                                                                                                                                                                                                                                                                                              |
| Medical          | `resolverKind = MEDICAL`; owner candidate is request id and owner target is patient owner scalar; primary stack is the bounded selected stock stack, secondary stack `NONE`, primary def/amount are stock def/requested amount; the four medical scalar fields are exact request/patient/condition/treatment ids. Slot 0 is `ITEM_QUANTITY` for the stock item entity with amount/total stack-quantity limit and `domainId = stockStackId`; slot 1 is `INTERACTION_SPOT` for the patient interaction entity/spot with `domainId = requestId`; slot 2 is `CELL` for the treatment cell with `domainId = requestId`. `transitionTargetSlot = 1`; job facts are the exact Medical row above. |
| Ordinary Hauling | `resolverKind = HAULING`; owner candidate is WorkOffer id and owner target is its opaque destination scalar; medical ids are `NONE`. Primary/secondary stack and slot ids, def/requested transfer amount and source/destination entity pairs come only from the fresh Hauling resolver. Slots are exactly source `ITEM_QUANTITY`, destination `CAPACITY`, source `INTERACTION_SPOT`, destination `INTERACTION_SPOT`; the reviewed descriptor fixes their domain ids and exact `transitionTargetSlot`. Job facts are the single Hauling row above. Every other Ordinary work type—including Lamp Patrol/Refill and cell-only/build work—is unmapped and fails before plan/acquire.         |

WM-0171 must read both fixed bundles allocation-free, re-read every named
dynamic owner fact and re-resolve the explicitly named immutable policy at its
exact manifest version, then mechanically construct the driver input from row
dynamic facts plus that reviewed policy. It may not claim the input comes
solely from the row, reconstruct Medical/Ordinary domain facts from claim ids,
rerun an unconstrained selector or consult hidden provider context. It uses
`readActiveClaimsInto` only to prove the row's exact active claim records before
calling the matching combined adoption root. The alternative claim-record-to-
owner-domain reverse lookup is rejected as a larger new public index. These
lanes are internal autonomy execution state under WM-0170's existing allowed
types/store/snapshot paths; they do not change the GameSession save format,
protocol or product projection.

The dynamic interface is never accepted as an allocation proof by itself. The
B3 manifest enumerates the exact construction-approved concrete plan bodies for
Food, Rest, Medical and Ordinary Hauling, including their fixed dispatch/helper
closure.
Every positive B3 construction site must resolve to one of those declarations;
an opaque or same-name provider is unresolved and fails closed. WM-0170 has no
default GameSession construction site, so its focused harness proves these four
bounded concrete providers only; WM-0171 must add its real product provider to
its own closure before integration rather than inheriting an interface-only
claim.

### Ordered B3 hot-path sequence

Every call uses construction-time injected owners plus caller-owned scratch and
outputs. No world, LocationStore, item/target owner, active JobCore row, driver
or GameSession state is changed; only the narrow JobCore reserved-token sidecar,
ReservationLedger and final Autonomy Store row may mutate as specified below.

1. Re-read the resident autonomy row. Require the same resident generation,
   `idle` state, row version and Store version selected by B2.
2. Re-read active actor identity, all five Need values and their owner versions,
   schedule/work/permission/meal/weather facts, wake facts, consciousness,
   movement, the selected-source ability and the inactive Job projection.
   Compare every value and version retained by B2; re-apply the hard safety
   gates. Failure stops before claim-plan access.
3. Re-read the selected owner row and its index/source basis using the matrix
   below. The candidate id, target id/cell and source-local policy facts must
   still match B2 exactly. Re-read the integrated channel/source-required
   claim-facts Into surface and compare every stack/ref/spot/cell/amount/capacity
   scalar and owner/row/index/reservation version retained by B2. Re-read the
   Food hunger value or Rest fixture rate and re-resolve the exact immutable
   Rest/Medical/Hauling policy manifest named by `jobFacts`; compare the full
   code/value prefix, kind and version. Failure stops before claim-plan access.
4. Re-read the complete path basis and verify map, navigation, region, room and
   region-graph versions, route length `1..128`, valid route cells, target-cell
   endpoint and cleared tail. Failure stops before claim-plan access.
5. Compute lease expiry by checked safe-add. Read `ReservationLedger.version`
   once. It must exactly equal the B2
   `reservationVersion` and be at most `0xffff_fffd`; the upper bound reserves
   one uint32 increment for acquire and one for possible compensation. Capture
   the current active count. Freshly read JobCore global version must be at most
   `0xffff_fffc`, and token selection must have a pre-reserve slot version at
   most `0xffff_fffc`, so successful reserve still leaves two increments for
   adoption plus guarded rollback. Any mismatch/exhaustion stops with no
   mutation.
6. Call `reserveAutonomyJobTokenInto` once in stable resident-decision order.
   Require exact owner, configured-range id, positive generation, expected
   global `+1`, eligible returned slot version, exact reserved/active/running/
   current-tombstone/cumulative-terminal counts and unchanged output identity.
   Failure performs zero plan/acquire calls.
7. Reset the fixed claim-plan output and call `claimPlans.readPlanInto(...)`
   exactly once with the eleven explicit scalar inputs plus the validated fixed
   `claimFacts` and `jobFacts` scratch. Validate the returned header, fixed refs,
   aliases, full token/slot version, generation-bearing transaction and fixed
   claim slots without allocation. Any failure releases the exact still-
   reserved token using its current slot version; release rejection retains the
   token and reports a fail-closed invariant breach.
8. Build a provisional claiming transition in existing scratch, using valid
   placeholders for the not-yet-known claim ids and predicted success ledger
   version `current + 1`, the exact `transitionTargetSlot` entity pair (or
   `NONE/NONE`) and the complete job-fact prefix. Call `validateTransitionInto`
   before acquire. This proves all caller-controlled Store shape relations but
   is not treated as proof of the future exact claim ids.
9. Call `ReservationLedger.acquireInto` exactly once with the token's positive
   job generation. On an atomic failure, publish no autonomy row, classify the
   returned structured reservation reason, then exact-release the reserved
   token.
   A successful output is structurally releasable only when the planned count
   was already trusted in `1..8`, `output.claimCount` exactly equals it, the
   original fixed id-buffer identity/length is intact, the readable prefix has
   exactly that many unique non-`NONE` ids and every unused tail entry is
   `NONE`. Version or active-count output mismatches are malformed evidence but
   do not make an otherwise exact id set unreleasable.
10. Only a fully valid success whose version and active count also equal the
    predicted values may continue to publication. Copy exactly the trusted
    planned/output count into the fixed transition claim-id lane, copy
    allocation epoch `priorVersion + 1` into every parallel active prefix entry,
    clear both tails,
    bind reservation version `priorVersion + 1` (which now equals the validated
    output), and re-run `validateTransitionInto` against the exact claiming row.
11. Call `transitionInto` once only after exact validation. Success publishes the
    claiming endpoint and leaves the owner-affine token `RESERVED`. Any exact
    validation or transition failure first calls integrated
    `releaseClaimsInto` once with precisely the ids/epochs/count and expected
    resident/pending-token binding from this acquire,
    `expectedLedgerVersion = priorVersion + 1`, never the untrusted
    `acquireOutput.version`, and returns a structured publication/compensation
    result. Claim release success must report version `priorVersion + 2`, the
    captured pre-acquire active count and exact planned count; only then may B3
    exact-release the reserved token. A claim-release failure retains both
    token and claims. A later token-release failure retains the token. Both are
    fail-closed invariant breaches with no broad cleanup or autonomy
    publication.

If a success-shaped acquire reports a wrong count, a short/replaced buffer, a
`NONE` or duplicate inside the planned prefix, or non-`NONE` tail residue, the
coordinator cannot prove the exact set that the ledger committed. It therefore
does not call exact release, does not guess from tail values, and never uses a
broad owner/job cleanup; it retains all malformed output and predicted-version
evidence plus the reserved token and fails closed. Conversely, wrong acquire `version` or `activeCount`
fields alone do not block compensation when the planned count and exact id set
are structurally trustworthy: claim release still uses trusted
`priorVersion + 1`, followed only on success by exact token release.

There is no other ledger operation between the pre-plan version read and
`acquireInto`, or between a successful acquire and `transitionInto`/
`releaseClaimsInto`: no record lookup, owner/job scan, amount query, legacy
release, cleanup or second acquire. This makes `prior`, `prior + 1` and optional
`prior + 2` the complete transaction version sequence.

### Frozen WM-0171 claim-adoption handoff

WM-0171 performs this separate sequence after reading a WM-0170 claiming row;
it is not part of B3's acquire call count:

1. Re-read the exact claiming row/version, resident generation, route, claim
   ids/epochs/count, claim/job facts and all owner/policy bases. Require
   `jobId = NONE`, a positive pending id/generation/slot version,
   `basis.jobVersion = 0`, `basis.driverVersion = 0`, the exact owner-affine
   JobCore `RESERVED` token at that slot version, and no active JobCore or
   selected driver row for that token.
2. Re-read every dynamic owner fact and exact immutable policy manifest named
   above. Freshly read the current ledger version and call
   `readActiveClaimsInto` once with that batch-consistency version and the row's
   exact ids/epochs/count, resident owner and pending token generation. The
   current global version may differ from the historical claiming reservation
   basis because of unrelated ledger work. Mechanically compare the complete
   claim record prefix, job generation, created/lease ticks and reset tail to the
   claiming bundle; never reconstruct owner-domain facts from a claim record.
3. Build the exact concrete driver input from the row's dynamic ids/facts plus
   the explicitly reviewed immutable policy. Before driver mutation, build and
   validate the expected claiming-to-moving/working transition. It uses the
   predicted next JobCore slot and selected driver store versions, copies the
   active job generation, clears all pending-token lanes and preserves exact
   route/claim-id/epoch custody. Require freshly sampled global JobCore, exact
   slot and driver versions all at most `0xffff_fffd` before adoption. A
   prediction mismatch stops before adoption.
4. Call the one matching combined adoption root exactly once. A normal
   validation/JobCore-create failure is all-before-any: driver and JobCore
   remain inactive/`RESERVED`, the autonomy row remains claiming and the claims
   remain active; unrelated global owner versions may continue to change. Keep
   that exact retained claiming row, token and claim set unchanged; do not call
   release or publish a claim-cleared row. It becomes retry-capable only after a
   fresh headroom check, never by label alone.
   There is no broad cleanup, legacy reserve, second acquire or release/
   reacquire retry. A later deterministic retry must re-read all bases and
   claims from scratch.
5. On adoption success, use only the five caller-owned Into reads to verify the
   exact post-adoption driver and JobCore token/kind/target/policy/ticks/step/
   status/progress/carried scalars, claim id/epoch prefix, owner bases, counts,
   metrics and returned slot/driver versions. The ledger remains unmutated by
   adoption, though its unrelated global version is not a durable guard. Only then
   publish the prevalidated autonomy `moving`/`working` row with
   `jobId/jobGeneration` copied from the pending token, all pending lanes cleared
   and exact returned JobCore-slot/driver versions. Success performs zero ledger release/acquire calls, so claim
   custody has no gap.
6. If any success-shaped adoption output is malformed, either post-adoption Into
   read rejects or mismatches, or the final autonomy transition rejects, call the
   matching `rollbackNewlyAdopted...Into` exactly once—never once per failed
   proof. A
   successful rollback proves the driver row inactive and JobCore token restored
   to the exact same `RESERVED` generation at predicted slot version `prior + 2`,
   with the ledger, claiming row and exact claim set unchanged. Re-read fresh
   global JobCore, slot and driver versions: only when all remain at most
   `0xffff_fffd` may that row be called retry-capable. Otherwise return distinct
   `autonomy_adoption_retry_version_exhausted` fatal evidence and prohibit an
   unconditional retry. If the guarded rollback rejects, likewise do
   not release claims, invoke JobCore terminal/broad cleanup or publish moving/
   working: preserve the matching RUNNING driver/job plus claims and claiming row
   as fail-closed evidence and
   surface an invariant breach for authoritative recovery. A rollback rejection
   can never be reported as a successful handoff.

Focused tests inject JobCore-create failure, each adoption precondition,
success-output and post-read mismatch, final autonomy-transition failure,
rollback version/state mismatch,
unrelated ledger/JobCore global mutation, old-token/old-claim ABA and retry. They
prove exact call counts, zero ledger release/acquire calls,
no partial driver/JobCore writes, unchanged claiming row/claim records on a
successful rollback, no orphaned or prematurely released claims, and that no
failure branch enters `moving` or `working`.

This is the exact WM-0171 compensation rule: undo only the newly adopted
driver/JobCore pair and retain the pre-existing claiming claim custody. Releasing
those claims while leaving the claiming row would create an invalid row that
references inactive ids, so no WM-0171 failure branch calls
`releaseClaimsInto`. Exact ledger release remains the B3 pre-publication
compensation surface defined above.

### Selected-source revalidation matrix

| Source           | Required fresh reads and exact relations before plan access                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Food             | `readPortionInto(candidateId, output)` plus the prerequisite exact ItemStack/Food job-fact read for that `stackId`; active/linked/safe/permission/schedule facts, def/slot/cell/spot, requested/available amount, `hungerRestore` and meal window match; food owner/index, item owner and reservation versions equal the retained facts; both dirty backlogs are zero. The returned item entity, not `stackId`, is slot 0 and the exact transition target.                                                                                                                                                                                                                              |
| Rest             | `readFixtureInto(candidateId, output)` plus a fresh bounded `RestCandidateIndex.selectCandidatesInto` with the retained B2 query/environment; find the same fixture in the caller-owned result; source/store/current/cached row versions, index version, zero backlog, target entity/kind/region/spot/cell/schedule/weather/exposure/outdoor/permission and `recoveryPerTickQ16` match. Re-resolve exact `recoveryTargetValue` from the immutable Rest policy and require it strictly exceeds fresh current Rest Need; checked difference times `65_536` must fit uint32. Otherwise return `rest_no_longer_needed` before plan/adoption. The fixture entity is slot 0 and exact target. |
| Medical          | `readPatientRequestInto`, `readCaregiverStateInto`, fresh `queryAbilityInto`, bounded exact medical stock selection/read and `readPatientInteractionInto`; patient/caregiver/condition/health/medical/base-ability/actor-condition versions and region/permission/treatment/stock-def/requested amount facts match. The concrete stock and patient interaction facts equal the retained claim facts. Re-resolve `treatmentTicks/workPerTickQ16/severityDelta` from the exact immutable treatment policy keyed by `treatmentDefId`. Patient interaction slot 1 is the exact transition target; `patientId` and `stockDefId` are never entity refs.                                       |
| Ordinary Hauling | `WorkOfferIndex.readOfferInto(candidateId, output)` plus the construction-approved Hauling resolver for the exact descriptor; WorkOffer owner/row/index, work type, region, definition, urgency, permission, opaque destination `targetId`, target cell, score and query fields match. Resolver source/destination claim facts, exact `HAUL_TRANSFER_AMOUNT`, policy kind/version and all owner versions equal the retained facts. Any non-Hauling descriptor fails before plan access.                                                                                                                                                                                                 |

Need, schedule, wake, capability, Job and path validation are common to all
four sources and run once, not once per owner. The B2 snapshot must retain a
baseline for every compared fact. In particular, before implementation the B3
types/store snapshot lane adds the wake event version captured at selection;
comparing only current wake facts without a retained version is prohibited.
This is an autonomy-owned basis addition, not a generic wake-owner edit.

For every source, each channel-required non-`NONE` entity or item ref is checked
against `EntityRegistry.generationAt(index)` and the corresponding fresh facts.
Target cell remains independent. Every
embedded entity/item/interaction/capacity slot ref aliases and equals its
validated channel ref. The claiming transition/reason entity pair equals only
the active slot named by `transitionTargetSlot`, or both are `NONE/NONE` when
that scalar is `NONE`; no optional-source-entity selection is allowed. A stale
generation, inactive required ref, forbidden extra ref or provider-created ref
not present in the fresh source output fails before acquire. Owner-local
`stackId`, `patientId`, `stockDefId` and WorkOffer `targetId` remain scalars and
are never validated or stored as `EntityId`s.

### Claim-plan structural acceptance

After the single plan call and before acquire, all of the following must hold:

- output/header/transaction/claims-array/ref/slot identities are unchanged from
  construction; transaction owner aliases the fixed owner ref; every emitted
  claim aliases one of the eight fixed slot refs and no slot is repeated;
- every `claimFacts` and `jobFacts` array identity is unchanged and length
  exactly eight; source/resolver/policy/scalar mappings and both exact prefixes
  match the tables above; both tails are exact; `claimFacts.channelCount ===
header.claimCount`; each emitted claim at index `i` exactly matches the
  channel/ref/cell/slot/amount/limit facts at that fixed index and its reviewed
  domain meaning;
- header is successful and exactly echoes selected source, candidate, target
  owner-local scalar and independent target cell; its positive pending job id/
  generation equal the transaction id/generation and its slot version equals the
  reserved JobCore token; transaction owner is the exact resident;
- `createdTick` equals request tick and claiming `stateEnteredTick`; lease
  expiry is not earlier and exactly equals both the checked safe-add result and
  persisted `claimFacts.claimLeaseExpiryTick`;
- `header.claimCount === transaction.claims.length` is an exact integer in
  `1..8` and fits every reservation/transition output capacity. After acquire,
  it also equals `reservationOutput.claimCount`, the transition `claimCount`
  and the compensation count;
- there are no holes, duplicate claim objects or cross-slot ref substitutions;
  every source-required entity, cell, interaction, quantity or capacity claim
  refers to the exact revalidated `claimFacts` channel. `transitionTargetSlot`
  is exact for the source/descriptor, and its entity pair equals the provisional
  transition/reason target; `NONE` requires both targets `NONE/NONE`. No entity
  claim is fabricated for an unmapped source; route endpoint and independent
  target cell remain consistent;
- a failed or malformed plan never reaches acquire. The fixed plan output is
  reset so no prior pending id, ref, claim or scalar can leak into the result;
  both read-only facts bundles and all their lane identities remain unchanged.

The acquire id output and transition claim lane contain the same exact ordered
prefix of `claimCount` unique, non-`NONE` ids. Both tails are `NONE`; the plan
transaction tail remains absent because its fixed claims array length equals the
count. No validator reads beyond the count, and no publication may reorder ids.

### Complete claiming transition row

| Field               | Exact B3 value                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| resident / expected | request resident index and generation; expected state `idle`; expected row version `r`; selected Store version unchanged through prevalidation                                                                                                                                                                                     |
| next state / ticks  | `claiming`; `stateEnteredTick = request.tick`; `retryTick = request.tick`; `claimLeaseExpiryTick` is the exact checked transaction lease and is preserved in transition/read/raw snapshot                                                                                                                                          |
| selection           | exact B2 source/candidate and opaque owner-local target scalar; selected target cell is independent; entity target is exactly the active `transitionTargetSlot` pair (Food 0, Rest 0, Medical 1, Hauling descriptor slot) or `NONE/NONE` only when that scalar is `NONE`                                                           |
| job                 | `jobId = NONE`, active `jobGeneration = 0`; pending id/generation equal header, generation-bearing transaction and exact owner-affine `RESERVED` token; pending slot version exact; interruption policy `NONE`; active JobCore/driver basis both `0`                                                                               |
| route               | exact B2 selected route, count `1..128`, cursor `0`, endpoint equal target cell, tail `NONE`                                                                                                                                                                                                                                       |
| claims              | `claimCount = header = transaction.length = acquire output count` in `1..8`; exact acquire id prefix in acquire order and parallel epoch prefix all `prior + 1`; id tail `NONE`, epoch tail zero; every ledger record carries the same pending job generation                                                                      |
| claim/job facts     | fixed `AutonomyClaimFactsLanes` and `AutonomyJobFactsLanes` exact copies of the fresh validated owner/policy facts; exact prefixes/target slot present, both tails reset, no mutable owner totals or object/reference identity                                                                                                     |
| decision facts      | exact revalidated need lane/value, ability and schedule code selected by B2                                                                                                                                                                                                                                                        |
| basis               | every revalidated B2 common/source/path and claim/job-facts owner/policy basis retained, including wake, Food item, Medical stock/patient interaction or Hauling resolver versions; historical reservation version is trusted `prior + 1`; pending JobCore slot version is exact; active JobCore/driver versions remain `0`        |
| reason              | code `RESERVATION_ACQUIRED`; source `RESERVATION`; subject exact resident; target exactly the `transitionTargetSlot` pair or `NONE/NONE`; first numeric parameter is pending job generation and tail zero; owner basis exact acquire version; suggestion `INSPECT_TARGET` only for a non-`NONE` slot, otherwise `INSPECT_RESIDENT` |
| successful output   | previous `idle`, next `claiming`, row version `r + 1`, Store version exactly pre-transition Store version `+ 1`                                                                                                                                                                                                                    |

### Mechanical failure and call-count matrix

The reservation table below retains `plan / acquire / autonomy transition /
claim release` counts. JobCore token calls are independently exact:

| B3 token case                                      | reserve / token release | Required token result                                                                                                                 |
| -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Any failure before token reservation               | `0 / 0`                 | JobCore unchanged                                                                                                                     |
| Token reservation rejects                          | `1 / 0`                 | No token, plan or acquire                                                                                                             |
| Owner already has `RESERVED`/`RUNNING` token       | `1 / 0`                 | Existing owner token unchanged; distinct owner-busy result, no second token/plan/acquire                                              |
| Any post-reserve failure before successful acquire | `1 / 1`                 | Exact `RESERVED -> original FREE/TOMBSTONE`; generation burned; slot/global versions each advance twice                               |
| Atomic acquire rejects                             | `1 / 1`                 | Same exact abort after proving zero claims                                                                                            |
| Claiming publication succeeds                      | `1 / 0`                 | Exact owner-affine token remains `RESERVED` at persisted slot version                                                                 |
| Post-acquire exact claim release rejects           | `1 / 0`                 | Retain token plus possible claims; fail closed                                                                                        |
| Post-acquire exact claim release succeeds          | `1 / 1`                 | Release token only after claims; token-release rejection retains fatal owner-recoverable token evidence and blocks any second reserve |

Thus “both owners unchanged” below means Autonomy Store and ReservationLedger;
a successfully aborted token truthfully burns its generation and advances
JobCore versions. No branch releases a token while same-generation claims may
remain active.

| Case                                                                                                                                                 | Plan / acquire / transition / release calls | Required authoritative result                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any autonomy, actor/entity generation, Need, schedule/wake, capability, selected owner/ref, job-fact/policy manifest, Job or path stale basis        | `0 / 0 / 0 / 0`                             | AutonomyStore and ledger unchanged; increment exactly the matching stale class once; retain B2 actual visited/ingress/retained/scored/path work without a second budget aggregation.                                                                                                  |
| Ledger differs/exceeds `0xffff_fffd`, JobCore global exceeds `0xffff_fffc`, or lease safe-add fails                                                  | `0 / 0 / 0 / 0`                             | Autonomy, ledger and JobCore unchanged; exact stale/version-exhausted/tick reason; no token/provider call and no hidden saturated lease.                                                                                                                                              |
| Claim-plan failure or malformed aliases/header/claims                                                                                                | `1 / 0 / 0 / 0`                             | Both snapshots unchanged; return exact plan/invariant reason; do not count a reservation conflict.                                                                                                                                                                                    |
| Plan count is `0`, negative, fractional, `>8`, exceeds fixed capacity or differs across header/transaction                                           | `1 / 0 / 0 / 0`                             | Both owners unchanged; exact plan-count invariant reason. These are rejected before the ledger and separately exercise the prerequisite release count reasons.                                                                                                                        |
| A required ref is inactive/stale, claim created/lease tick differs or `transitionTargetSlot` is wrong                                                | `1 / 0 / 0 / 0`                             | Both owners unchanged; exact stale-channel-ref, claim-tick or plan-reference invariant reason.                                                                                                                                                                                        |
| Provisional Store validation failure                                                                                                                 | `1 / 0 / 0 / 0`                             | Both snapshots unchanged; return structured publication-shape failure.                                                                                                                                                                                                                |
| Acquire conflict, shortage, capacity, target generation stale or invalid transaction                                                                 | `1 / 1 / 0 / 0`                             | AutonomyStore unchanged; no partial claims/amounts/active-count change; claim-id output tail reset to `NONE`; ledger version unchanged; increment reservation conflict only for the defined conflict/shortage/capacity classes.                                                       |
| Acquire reports success with trusted planned/equal count and exact unique non-`NONE` prefix/`NONE` tail, but output version or active count is wrong | `1 / 1 / 0 / 1`                             | No autonomy publication; the exact acquired set is still trustworthy, so compensate with `expectedLedgerVersion = prior + 1`; retain the malformed scalar evidence. Never use the untrusted output version.                                                                           |
| Acquire reports success with count mismatch, short/replaced id buffer, malformed/duplicate/`NONE` prefix or non-`NONE` tail                          | `1 / 1 / 0 / 0`                             | No autonomy publication. The exact acquired set cannot be proven, so exact release is unsafe; retain evidence and fail closed without guessing ids or invoking broad cleanup.                                                                                                         |
| Successful acquire and claiming publication                                                                                                          | `1 / 1 / 1 / 0`                             | One claiming row at `r + 1`; exact token, claim ids/epochs/count and acquire version persisted; no active Job/driver/world/position/item/target mutation.                                                                                                                             |
| Successful acquire, then exact validation or injected transition failure                                                                             | `1 / 1 / 0..1 / 1`                          | AutonomyStore snapshot exactly unchanged; active records/counts/channel amounts restored to pre-acquire semantics by exact compensation. Ledger version and acquired/released metrics truthfully advance for acquire plus release and are not asserted byte-identical.                |
| Compensation count, duplicate, invalid/inactive id, owner, job/generation/epoch, expected-version or version-exhaustion rejection                    | `1 / 1 / 0..1 / 1`                          | No autonomy publication, token release or broad cleanup; `releasedCount = 0`, current version/active count and exact `claimIndex`/`claimId`/reason exposed; every claim and the token remain because validation is before-any. Test injection proves none can be reported as success. |
| Successful compensation                                                                                                                              | `1 / 1 / 0..1 / 1`                          | Claim release count equals the trusted planned/acquire count, release version equals `prior + 2`, active count/channel links restore and next claim ids match pre-acquire order; only then exact token abort runs, preserving burned job generation.                                  |

WM-0171 uses this separate call matrix (`claim-read / adopt / post-adoption
proof bundle / autonomy transition / guarded rollback / ledger release`):

| Handoff case                                                                            | Exact calls         | Required authoritative result                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner/policy/claim basis stale or malformed before adoption                             | `0..1/0/0/0/0/0`    | Claiming row, driver, JobCore and ledger unchanged; exact stale class. A successful claim read is read-only.                                                                                                     |
| Combined adoption validation or atomic running-JobCore creation rejects                 | `1/1/0/0/0/0`       | Driver inactive and JobCore token still exact `RESERVED`; claiming row/token/claims remain. A later attempt requires fresh owner facts and global/slot/driver headroom, never an unconditional retry-safe claim. |
| Adoption succeeds and autonomy publication succeeds                                     | `1/1/1/1/0/0`       | Exact generation-aware driver claim bindings and JobCore `RUNNING/path_to_source`; autonomy binds token/versions without a ledger gap.                                                                           |
| Adoption succeeds, any output/read/publication proof rejects, guarded rollback succeeds | `1/1/0..1/0..1/1/0` | Exactly one rollback attempt covers all failed proofs; driver inactive and token restored `RESERVED`. Retry requires fresh global/slot/driver headroom `<= 0xffff_fffd`, otherwise fatal.                        |
| Adoption succeeds, any output/read/publication proof rejects, guarded rollback rejects  | `1/1/0..1/0..1/1/0` | No moving/working publication or broad cleanup/release; preserve RUNNING driver/JobCore, claims and claiming row as fatal evidence.                                                                              |

No handoff row has a non-zero release count. An abandonment policy that clears a
claiming row and releases claims would require a separately reviewed cross-owner
protocol; it is not hidden inside WM-0171.

Normal terminal uses a separate exact matrix (`new domain effect / exact claim
release / non-failing driver+JobCore+autonomy commits`):

| Terminal case                                     | Exact calls       | Required result                                                                                                               |
| ------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Any owner/effect/token/autonomy preflight rejects | `0 / 0 / 0`       | All owners unchanged; no cleanup phase or claim mutation                                                                      |
| New domain effect/compensation commits            | `1 / 0..1 / 0..1` | Effect and phase commit atomically once; any release rejection leaves explicit pending state and never repeats the effect     |
| Effect already committed, cleanup not finished    | `0 / 0..1 / 0..1` | Never repeat effect; enter/retain `TERMINAL_CLEANUP_PENDING` and attempt only cleanup                                         |
| Exact same-generation claim release rejects       | `0..1 / 1 / 0`    | Pending phase and once-only flags retained; token non-reusable; later call retries release only                               |
| Exact release succeeds                            | `0..1 / 1 / 1`    | No domain mutation remains; driver retire, JobCore tombstone and autonomy terminal publication are one non-failing typed tail |
| Call repeats after retired/tombstone publication  | `0 / 0 / 0`       | Structured already-terminal result; no domain, metric, release or count delta                                                 |

Every branch also proves scratch/output/typed-array/ref identities, deterministic
reason and metric deltas, cleared unused tails, one selected resident only and
zero legacy materializer calls. Claiming success reads the row back and proves
every fixed claim/job-construction lane including target slot and exact lease;
raw snapshot/restore round-trips the same values and rejects cross-source
residue, bad tails or a missing source-required lane. WM-0171 handoff fixtures
construct each real job input from row dynamic facts plus the explicitly named
reviewed immutable policy, with no hidden provider state, object identity,
claim-id domain reverse lookup or reselection.
Token fixtures additionally prove two residents cannot collide under either
decision order, a terminal id is reused only with a new generation, stale token
and same-id old-generation claims fail ABA guards, unrelated global JobCore/
ledger version changes do not block fresh slot/epoch reads, and snapshot/restore
preserves reserved/running/tombstone state. Every token/adoption/terminal failure
point proves all-before-any or the frozen release-then-nonfalling sequence. Lamp
Patrol/Refill fixtures prove structured unmapped failure with zero plan/acquire.
Driver fixtures prove every current/cumulative count delta, origin-shadow
replacement, Float64 Tick above uint32, unsafe/time-reversed Tick rejection,
effect-phase snapshot/hash roundtrip and duplicate pickup/consume/recover/
deliver/return/treat/terminal calls. Version fixtures cover all four
`fffc..ffff` values for ledger global, JobCore global/slot and every driver.
Acquire rejection tests cover first/middle/last
claim failures and prove transaction atomicity rather than only active count.
The release prerequisite separately covers count `0`, negative, fractional,
`>8` and `>claimIds.length`, plus invalid/inactive/duplicate/owner/job/version
failures with exact reasons and offending indices. No case permits a broad
owner/job release to mask an exact-compensation failure.

### B3 allocation and boundary closure gate

The existing TypeScript `Program`/`TypeChecker` BFS is extended from
`ResidentAutonomyCoordinator.decideInto` through all newly reachable B3
declarations and accessors. The positive manifest must include at least
`validateTransitionInto`, `transitionInto`, the concrete fixed claim-plan
provider(s), `acquireInto`, integrated `releaseClaimsInto` and
`readActiveClaimsInto`, JobCore token reserve/release/id-read/owner-read, Food/Rest/Medical/
Ordinary-Hauling fresh claim/job-fact reads,
the exact ItemStack Into read, bounded Medical stock and patient-interaction
surfaces, immutable Rest/treatment/Hauling policy receivers, the one concrete
Hauling resolver, Rest fresh indexed selection and ability query. It keeps
receiver-exact identity, complete declaration/accessor scanning, duplicate-free
manifest/digest and zero unresolved or unexpected calls.

`AutonomyClaimPlanSource.readPlanInto` is a dynamic interface boundary; the
checker must not pretend that its interface declaration supplies a concrete
body. Its receiver resolution table contains the exact Food, Rest, Medical and
Ordinary-Hauling concrete provider declaration used by each positive construction site,
plus every prerequisite claim-facts receiver and helper each provider reaches.
The fixed source and construction-extensible Ordinary descriptor registry is
audited; the B3 registry contains Hauling only and the
four provider manifests are duplicate-free and contribute to the final digest.
An unmapped work type/construction site—including Lamp Patrol/Refill—opaque
provider, hidden mapping or fake same-name receiver fails closed with zero plan/
acquire. Synthetic negatives cover allocation,
interpolation/concatenation, higher-order calls, `for-of`, spread/rest,
async/generator syntax, allocating getters/setters and unresolved dynamic
receivers.

The production closure forbids `releaseClaims`,
`releaseReservationsForOwnerJob`, reservation `createMetrics`/`createSnapshot`,
legacy materializing owner APIs, unbounded scans/sorts and every JobCore mutation
except exact autonomy-token reserve/release. Active JobCore rows, world,
LocationStore, item/target owner and GameSession remain mutation-forbidden. Snapshot creation is
test-only. Final B3 gates are scoped typecheck, the complete focused autonomy
suite, prerequisite ledger and claim-facts regression suites,
allocation/closure negatives,
package-boundary checks and updated WM-0170 report evidence, followed by an
independent Canvas review checkpoint.

The second prerequisite separately audits each claim-ready owner,
`M4LampNetworkStore.readLampInto`, JobCore token/state/tombstone roots,
`JobCoreStore.createRunningJobInto`, all five allocation-free committed-state
reads, all four combined adoption/rollback roots, every listed autonomous driver
mutation, effect-phase/domain owner closure, exact generation-aware terminal
cleanup and legacy reserve lane synchronization. WM-0171 extends its claiming-
handoff closure through the exact concrete adoption receiver selected by each
construction site and rejects legacy `createJob`+reserve, `enterStep`, every
handoff acquire/release/broad cleanup, hidden policy receivers and unresolved
same-name methods. Its separately audited normal-terminal closure permits only
the exact prevalidated same-token release followed by non-failing driver/
JobCore/autonomy terminal commits. A registered Lamp construction adds the Lamp read/provider/
driver receivers to WM-0171's closure without editing WM-0170 or lamp owner.
