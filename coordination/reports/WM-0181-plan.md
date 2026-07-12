# WM-0181 Execution Plan

## Objective and baseline

Add only the reviewed caller-owned, version-bound `Into` selection/read
surfaces required for WM-0170 to consume the existing food, rest and medical
exact indexes without allocation. Preserve those owners as the sole truth and
do not mirror their candidates into generic WorkOffer rows.

- Planning baseline: `166705b`, equal to the branch upstream when the audit
  began.
- Baseline gates: sim-core typecheck passed; the existing food/rest/medical/
  owner-hot-path suites passed as 4 files / 29 tests before implementation.
- Worktree: one worktree; WM-0181 is the sole `in_progress` task and WM-0170
  remains blocked with its non-complete Phase A/B1 checkpoint.
- Execution is restricted to the eight product/test files and WM-0181
  coordination files listed in the task packet.

## Inputs read

- `AGENTS.md` and the complete `wuming-town-agent-workflow` skill.
- WM-0181, WM-0170, WM-0171 and WM-0177 task/report packets, ADR-0018, the
  autonomous-town architecture sections 5-7 and 15, and the AI/Job/Reservation
  system contract.
- Full implementations and focused tests for food, rest/sleep and medical
  care, plus `owner-hot-path-surfaces.test.ts` and the sim-core package root.

## Read-only owner audit

### Food

`M3FoodAvailabilityStore.selectCandidates` returns a newly materialized result
and `readPortion` materializes a view. Selection exposes store/item versions but
does not bind all retained rows, targets, scores, meal-window versions and
dirty-backlog state into one caller-owned output. `markStackDirty` does not
advance `version`, so equality of only `foodAvailabilityVersion` is not a valid
final stale check.

### Rest

`RestCandidateIndex.selectCandidates` materializes a result and its optional
trace path uses object spread/object construction. `RestSleepStore.readFixture`
materializes both the fixture view and nested `EntityId`. The index already has
private `sourceVersion`, `indexVersion` and per-fixture owner versions, but the
selected row, target, score, schedule/weather basis and all cap counters are
not written into one caller-owned result.

### Medical

`selectTreatmentRequests`, `readPatientRequest` and `readCaregiverState`
materialize results. The selection hot chain calls allocating
`health.readCondition` and the allocating caregiver read. A global medical
store version is insufficient: failed caregiver ability/permission refresh can
change cached caregiver lanes without advancing that version. The existing
actor-condition/base-ability/valid/allowed lanes must be bound to selection and
re-read through caller-owned outputs; patient condition staleness can be
checked conservatively with the cached row basis plus current primitive health
store version, without `readCondition`.

### Allocation audit and exports

The existing owner-hot-path suite audits 11 roots, 42 class helpers and 27 free
helpers. It rejects construction of objects, arrays, typed arrays, closures,
templates, regular expressions, string factories and dynamic string `+` in the
complete transitive closure. Its receiver-exact project-object mapping covers
the earlier Map/Path/WorkOffer/Reservation/Health owners only. All seven new
roots, their reachable helpers and the existing Health `Into` calls must join
that same audit without weakening the allowlist. Food, rest, medical and health
use distinct scanner module namespaces so same-named helpers cannot resolve to
the wrong body; a collision regression and receiver-exact cross-owner mapping
are required. The package root currently exports none of the new roots or
scratch/output types.

No further architecture stop-line was found inside the eight-file WM-0181
scope.

## Frozen additive API contract

The exact seven public roots are:

1. `M3FoodAvailabilityStore.selectCandidatesInto`
2. `M3FoodAvailabilityStore.readPortionInto`
3. `RestCandidateIndex.selectCandidatesInto`
4. `RestSleepStore.readFixtureInto`
5. `M3MedicalCareStore.selectTreatmentRequestsInto`
6. `M3MedicalCareStore.readPatientRequestInto`
7. `M3MedicalCareStore.readCaregiverStateInto`

Every root resets every output lane on entry and returns `void`. It accepts only
caller-owned query/scratch/output objects and fixed preallocated typed lanes.
Legacy allocating methods remain public and behavior-compatible; focused parity
tests compare their scalar facts and ordering against the new roots. The new
medical output alone reports the exact bucket total; the legacy method keeps
its historical visited-count value in `bucketCandidateCount` for compatibility
and that known mislabeled field is excluded from parity.

### Food scratch and output

- Add flat `M3FoodPortionIntoOutput`,
  `M3FoodCandidateSelectionIntoScratch` and
  `M3FoodCandidateSelectionIntoOutput` contracts.
- Scratch retains at most 12 stack ids plus aligned integer score, item owner
  version, meal-window version, target-cell and relevant permission/schedule
  facts; no selected row is recoverable only through ambient store state.
- Output binds total bucket candidates, visited/selected rows, both cap hits,
  selected first-row facts, food/index version, source item version and the
  exact dirty backlog observed in the same call.
- `readPortionInto` writes all existing portion fields, active/linked state,
  item/store/meal versions and dirty backlog without creating a view.

### Rest scratch and output

- Add flat `RestFixtureIntoOutput`,
  `RestCandidateSelectionIntoScratch` and
  `RestCandidateSelectionIntoOutput` contracts plus a caller-owned
  `RestCandidateEnvironmentBasis`.
- Scratch aligns retained fixture ids with score, the index-cached fixture
  version, the current store row owner version, entity index/generation, target
  cell and schedule/weather facts. A cached/current fixture-version mismatch
  fails the selection even when another dirty fixture was refreshed and the
  global source version caught up.
- Output binds `RestSleepStore.version`, candidate `sourceVersion`,
  `indexVersion`, dirty backlog, bucket total, visited/selected counts,
  `scheduleWindowVersion`, `weatherVersion`, `weatherSourceVersion` and cap
  hits from the same call. Those three environment owner versions are explicit
  scalar inputs to the `Into` call alongside schedule-window id, weather
  exposure and outdoor-work-allowed decision, and are copied into the coherent
  output for WM-0170 phase-two comparison; a combined `environment.version` is
  not used as a substitute.
- The `Into` selection path does not accept the allocating trace object path;
  any trace evidence used by legacy scenarios remains outside the autonomy hot
  root.

### Medical scratch and output

- Add flat `M3MedicalPatientRequestIntoOutput`,
  `M3MedicalCaregiverStateIntoOutput`,
  `M3MedicalSelectionIntoScratch` additions and
  `M3MedicalSelectionIntoOutput`.
- Selected request lanes bind request id, target cell, score, patient/
  condition ids, condition/actor-condition/health-store basis, treatment/stock
  facts and every rejection/cap counter.
- Maintain a private exact bucket count beside the existing heads/links. The
  new output reads that counter before bounded traversal; it never scans past
  24 rows and never substitutes `visitedCount` for `bucketCandidateCount`.
- Caregiver output binds region, permission, ability lane/value/minimum,
  actor-condition version, base-ability version, valid and allowed flags.
- `M3MedicalSelectionIntoOutput` copies the complete caregiver tuple
  (caregiver id, ability lane/minimum/value, condition/base versions,
  valid/allowed flags) plus the medical store version. The tuple may not exist
  only in temporary scratch or ambient store state.
- Selection reuses caller-owned caregiver and `M3AbilityQueryIntoOutput`
  scratch. It must not call `readCondition`, `queryAbility`, or either
  materializing medical read.
- Current primitive health store version plus cached request basis provides a
  conservative stale rejection; current ability `Into` facts must exactly
  match the cached caregiver tuple before selection can succeed.

## Ordering, caps and version invariants

- New `Into` calls accept positive caller caps only to support smaller bounded
  probes, but reject `candidateCap > 24` and retained caps greater than 12.
  Every aligned scratch lane has fixed capacity at least 12; undersized scratch
  is reset/rejected before traversal or partial output.
  Legacy allocating APIs keep their historical validation behavior. Exact path
  cap 4 remains owned by WM-0170 and is not implemented in this repair.
- Ordering is integer score descending, then `sourceRowId` ascending, where the
  row id is stack id / fixture id / request id for food / rest / medical.
  Target id is retained as the third cross-source merge key for WM-0170; inside
  one owner index the unique row id makes that third key mechanically a no-op.
  No unbounded sort or callback comparator is added.
- A selection output and its retained aligned lanes are one version-coherent
  result. Row facts may not be re-read through a different source or inferred
  from a global version.
- Food final revalidation compares store version, selected item/meal basis and
  dirty backlog; any nonzero backlog rejects even when the store version is
  unchanged.
- Rest final revalidation compares `RestSleepStore.version`, candidate
  `sourceVersion/indexVersion`, the index-cached and current selected fixture
  owner versions, selected schedule/weather row, `scheduleWindowVersion`,
  `weatherVersion` and `weatherSourceVersion`. A regression must cover dirty A
  omitted, dirty B refreshed, and sourceVersion catching up while A remains
  stale.
- Medical final revalidation compares the selected patient condition basis,
  current health store version and the complete caregiver ability tuple. A
  medical store-version match alone never authorizes care.

## Implementation sequence and gates

1. **Food phase** — add the two roots and flat types, preserve legacy parity,
   and test output reset/identity, 24/12 caps, stable order, item/meal/store
   basis and dirty-without-version-change rejection. Run focused food tests,
   typecheck, ESLint and Prettier before continuing.
2. **Rest phase** — add the two roots and flat types, keep trace allocation out
   of the new root, and test output reset/identity, 24/12 caps, stable order and
   store/source/index/fixture/schedule/weather staleness. Run focused rest
   tests and the mechanical gates before continuing.
3. **Medical phase** — add the three roots and flat types, use only primitive
   health facts plus caller-owned ability output, and test caregiver failure
   without medical-version advance, patient/health staleness, caps/order and
   legacy parity. Run focused medical tests and the mechanical gates.
4. **Closure/export phase** — export all seven roots and types; give food,
   rest, medical and health distinct scanner module identities; extend the
   receiver-exact cross-owner mapping to every reachable helper; add a
   same-named-helper collision regression; prove forbidden legacy reads are not
   called; and run the four focused suites together.
5. **Final task gates** — run every check listed in WM-0181, update
   `coordination/reports/WM-0181.md`, self-review the exact diff, then use
   `taskctl complete` for independent review. No benchmark/admission command is
   required by this task.

## Stop lines

- Stop if satisfying an acceptance requires any ninth product/test file,
  `game-session-autonomy*`, `m3-health*`, WorkOffer, pathing, reservation,
  GameSession, protocol, Worker, app, save/load, dependency, benchmark,
  admission or release change.
- Stop rather than mirror need-driven candidates into WorkOffer, scan all
  entities/map cells/store rows, allocate in a new hot closure, use callbacks,
  weaken the AST allowlist, or infer stale safety from one global version.
- Stop if an existing allocating API, snapshot, hash, driver or historical
  scenario changes behavior instead of remaining additive/compatible.
