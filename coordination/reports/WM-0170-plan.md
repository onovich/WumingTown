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

## Post-WM-0177 public API audit: ordinary surfaces PASS; need-driven indexes BLOCKED

Commit `2ac4416` resumed WM-0170 after reviewed prerequisite WM-0177 was
integrated. Its audit proved the ordinary WorkOffer, path, reservation and
ability surfaces below, but the later independent B1 review showed that this
was not the complete WM-0170 owner audit required by the architecture:

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

### Second stop-line decision

Canvas independently found that `M3FoodAvailabilityStore.selectCandidates`,
`RestCandidateIndex.selectCandidates` and
`M3MedicalCareStore.selectTreatmentRequests` still materialize result objects
and lack reviewed caller-owned row reads. Architecture section 6 requires
need-driven food, rest and treatment to use those exact indexes, while ordinary
hauling/lamp work uses `WorkOfferIndex`. Therefore the public API audit is
blocked for the three need-driven sources even though the ordinary-owner audit
passes.

An independent systems-architect rejected mirroring food/rest/treatment into
generic WorkOffer rows because that would duplicate owner truth, create
non-atomic dual publication, and lose meal-window, rest schedule/weather and
patient/caregiver basis. The approved repair is strict prerequisite WM-0181,
limited to caller-owned, version-bound `Into` surfaces on the three generic
owners plus their tests and package-root exports.

WM-0170 stopped immediately after this decision. The current Phase A/B1
checkpoint contains the typed state/reason store, snapshot guards, durable
terminal policy/job basis, serializable `pendingJobId`, and an interface-only
selection draft. It does not contain a coordinator body. The selection draft
is explicitly not approved: after WM-0181 it must add a numeric candidate
source discriminator, generic source-local row/index basis, fixed five-lane
arbitration, and caller-owned mutable claim-plan header/transaction/claim-slot
scratch before B1 can pass independent review.

## Frozen API and state-lane design

- `ResidentAutonomyStore` owns one fixed typed-lane row per resident. The exact
  states are `idle`, `claiming`, `moving`, `working`, `blocked`, `completed`,
  `failed` and `interrupted`. Rows contain only scalar resident/source-local
  candidate/offer/job/pending-job/target references, state/retry ticks, bounded
  route/claim references and the
  complete need/schedule/capability/offer/path/reservation/job version basis;
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
- Fixed caps are 24 visited, 12 retained/scored, 4 exact paths, 2 new decisions
  per tick, 128 route cells and 6 reason parameters. Ordering is score
  descending, then source-row id ascending, then target id ascending. Metrics expose
  totals, each cap hit, exact paths, node expansions, stale classes,
  reservation conflicts and decision deferrals.

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
