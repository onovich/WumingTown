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

## Public API audit result: blocked before step 2

The current public surfaces cannot satisfy two simultaneous WM-0170 hard
requirements without editing forbidden generic owners:

- `WorkOfferInput` contains no owner version and `WorkOfferIndex` exposes no
  monotonic index version. `readOffer` materializes a new object, while
  `selectTopOffers`/`selectPathResolvedWorkOffer` also return newly allocated
  result objects. A selected row therefore cannot be atomically tied to the
  producing owner's version, and the hot decision path cannot be allocation
  free through this API.
- `GridPathfinder.findPath` creates a new `Uint32Array` for every successful
  exact path. There is no public `findPathInto`/caller-owned route output.
- `ReservationLedger.acquire` creates `PreparedClaim[]` and `claimIds[]` for
  every transaction. There is no public caller-owned transaction scratch or
  claim-id output surface, even though its all-or-nothing semantics are
  otherwise correct.
- `M3AbilityCacheStore.queryAbility` materializes a result object for every
  query. There is no caller-owned result lane.

WM-0170 explicitly says to stop and block the systems architect if the public
APIs cannot meet the contract, and its allowed paths prohibit changing these
owners. Product implementation therefore stops here. A reviewed prerequisite
repair must add version-bound WorkOffer reads plus allocation-free caller-owned
query/path/reservation/ability outputs (or explicitly revise the allocation
contract) before WM-0170 can resume.

## Scope guards

- No `game-session-autonomy*.ts` product module is created while blocked.
- No generic WorkOffer, pathing, ReservationLedger, needs, schedule, health or
  ability owner is modified as a workaround.
- No GameSession integration, protocol, Worker, Web/Pixi/HUD, save, dependency,
  PR-3 or release surface is changed.
