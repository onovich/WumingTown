# Autonomous Town Life Architecture

Status: WM-0169 planning proposal for PR-2. PR-1 is independently verified,
integrated and done; no PR-2 implementation is claimed or promoted by this
document. ADR-0018 is the proposed projection/speed decision. GameSession
save/load remains unsupported and public/release gates remain unchanged.

## 1. Scope and product truth

PR-1 established an `integrated prototype`:

- one authoritative `GameSessionRuntime` in Worker/headless;
- a fixed 30-TPS Worker clock proven for 600 wall-clock seconds;
- eight same-session residents plus resources, alerts and selection details;
- schema-3 GameSession projection v1 with fail-closed negotiation;
- product-consumed moving and working frames for one bounded minimum job;
- deterministic 18,000/100,000-tick parity and zero-leak evidence.

Those facts remove the old static-clock blocker, but they do not prove PR-2.
Only one minimum resident/job lifecycle is integrated. Broader needs, shifts,
abilities, food, rest, hauling, lamp patrol and treatment still live mostly in
historical stores and scenario harnesses. There is no reviewed full-day
autonomous town, path interpolation, 4x product speed, or independent human
acceptance. The project is not yet an `autonomous prototype`, `internal
playable`, saveable product or release candidate.

PR-2 has one player-facing result: without assigning residents one by one, a
player can watch eight residents eat, rest/sleep, haul, patrol/refill lamps,
treat an injury, wait or explain why they are idle/blocked/failed over a full
game day. Movement, work and progress must be perceptible in the real default
Web product, not only in a debug payload or headless trace.

## 2. Fixed acceptance scenario

The canonical PR-2 scenario is `pr2-autonomous-town-life` and retains the
integrated PR-1 world lineage.

| Fact            | Required value                                                                      |
| --------------- | ----------------------------------------------------------------------------------- |
| Map             | At least 64 x 64 navigable cells with versioned region/navigation basis             |
| Day             | 36,000 fixed ticks; 20 minutes at 1x, 10 at 2x, 5 at 4x                             |
| Residents       | Exactly eight default authoritative residents for the gate                          |
| Needs           | Hunger, rest, comfort, social and safety owner lanes                                |
| Schedules       | At least two staggered work/rest shifts plus day/night windows                      |
| Capabilities    | Movement, manipulation, stamina and treatment permission/ability facts              |
| Resources       | Food, wood, stone, lamp oil and one medical stock lane                              |
| Facilities      | Storage, food interaction, eight bed slots, lamp route and treatment interaction    |
| Autonomous work | Eat, rest/sleep, haul, lamp patrol/refill and treatment; explicit wait/idle reasons |

At a deterministic checkpoint, at least three residents must be concurrently
performing three different work kinds. Every resident must perform at least one
non-idle autonomous transition during the day. The scenario intentionally
contains one recoverable shortage/contention and one schedule/ability denial so
structured `blocked`/`failed`/idle explanations are exercised without a player
command or test-only state injection.

The scenario definition owns only initial facts and expected evidence windows.
It does not own ticks, decisions, jobs, routes, reservations, positions,
projection state or save state.

## 3. Authority and owner graph

```text
ScenarioDefinition + compiled content
              |
              v
GameSessionRuntime (authoritative, sim-core)
  EntityRegistry / MapGrid / LocationStore / SpatialIndex
  NeedStore / DayNightStore / schedule policy / ability cache
  WorkOfferIndex and owner-specific candidate indexes
  ResidentAutonomyStore (decision/activity/reason references)
  JobCoreStore + explicit life/work drivers
  ReservationLedger + active bounded route lanes
  item/storage/lamp/health owner stores
              |
       fixed integer ticks
              |
Simulation Worker host (wall clock, pause, 1x/2x/4x, backpressure)
              |
 schema-4 GameSession projection v2
              |
 Pixi interpolation + React focused HUD (read-only)
```

Owner rules:

- `LocationStore` alone owns authoritative entity position.
- `NeedStore`, schedule/day-night facts and ability cache own decision inputs.
- Work-producing owner stores own target availability. `WorkOfferIndex` and
  food/rest/medical/lamp/storage indexes are derived and versioned.
- `ReservationLedger` alone owns active claims.
- `JobCoreStore` and the selected typed driver own step/progress/carried facts.
- `ResidentAutonomyStore` owns the resident's current decision/activity state,
  references to offer/job/path/target, state-entered tick, retry tick and
  structured reason. It must not duplicate item quantity, position,
  reservation ownership or driver progress.
- The active route lane owns only the accepted bounded route, navigation basis
  and cursor needed by the explicit moving step. It never performs discovery.
- Worker owns wall-time scheduling and delivery queues, never simulation facts.
- Pixi/React own camera, hover, selection, locale and interpolation only.

No singleton, Promise chain, generator, coroutine, closure-only cursor or
object reference may preserve execution position. Every authoritative lane has
a deterministic snapshot/read method even though public save is not yet
implemented.

## 4. Serializable activity state machine

Every resident has exactly one explicit state:

| State         | Required authoritative facts                                 | Legal next states                                    |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `idle`        | reason, next-decision tick, decision basis                   | claiming, interrupted                                |
| `claiming`    | selected offer, target, candidate/path basis, claim attempt  | moving, working, blocked, failed, interrupted        |
| `moving`      | job id, target, route basis/window/cursor, reservations      | working, blocked, failed, interrupted                |
| `working`     | job/driver step, integer progress, target, reservations      | completed, blocked, failed, interrupted              |
| `blocked`     | reason, retry policy/tick, retained-or-released claim policy | claiming, moving, working, idle, failed, interrupted |
| `completed`   | terminal job/event reference and completed tick              | idle                                                 |
| `failed`      | terminal job/event reference and structured failure          | idle                                                 |
| `interrupted` | source/reason, safe-point result and cleanup outcome         | idle, claiming                                       |

`completed`, `failed` and `interrupted` are durable terminal records in a
bounded event/history lane even when the resident returns to `idle`; they are
not fabricated UI delays. `moving` and `working` durations come from real route
steps and integer work amounts and must naturally span at least two coherent
product publications at 1x. Extending an already-complete job only to make an
animation visible is forbidden.

State transition invariants:

1. A resident cannot own two active jobs or two routes.
2. `moving`/`working` requires an active JobCore job and its required claims.
3. A terminal driver transition releases all normal claims exactly once.
4. An interruption follows the driver's `Never / AtSafePoint / Immediate /
EmergencyOnly` policy and records cleanup results.
5. A stale offer, path, target, schedule, capability or reservation basis is
   rejected before mutation.
6. A reason is replaced atomically with the state transition; stale prose never
   survives as current truth.

## 5. Needs, schedules and capabilities

Decision priority is deterministic and integer-based:

1. hard safety/health constraints and emergency need thresholds;
2. already-running non-interruptible work;
3. active schedule window and allowed work classes;
4. hunger/rest/health urgency from indexed need lanes;
5. capability and permission masks;
6. indexed ordinary work offers;
7. bounded wait/backoff with a structured idle reason.

Emergency hunger, exhaustion, safety or treatment may request interruption of
ordinary work. The driver policy decides whether it happens immediately or at
a safe point. A shift boundary does not teleport a resident or delete carried
items; it requests a structured interruption and normal cleanup.

Schedules are owner facts keyed by resident and day window. They can allow
work, rest/sleep, meal or on-call treatment. Capabilities are integer/bitset
facts with owner versions; a stale ability cache cannot authorize work. Neither
surface is a player-configurable priority system in PR-2. Player work-policy
editing belongs to PR-3.

## 6. Indexed Top-K decision pipeline

Resident thinking never scans the map, every entity, every store row or every
work type. Work producers update exact derived buckets when owner state changes.

The PR-2 default caps are:

| Stage                                   |                  Cap |
| --------------------------------------- | -------------------: |
| WorkOffer rows visited per exact bucket |                   24 |
| Candidates retained/scored              |                   12 |
| Exact path attempts                     |                    4 |
| Resident decisions started per tick     |                    2 |
| Active route cells stored per job       |                  128 |
| Route cells published per resident      | 32 around the cursor |
| Structured reason scalar parameters     |                    6 |

Queries name work kind, region, Def/target class, urgency bucket, permission and
schedule class. Need-driven food/rest/treatment queries use their existing
exact indexes and the same 24/12/4 bounds. Ordinary hauling/lamp queries use
`WorkOfferIndex` buckets.

Scoring uses integer terms only: hard priority, need urgency, schedule fit,
capability value, work-offer urgency, regional distance estimate, continuity
bonus and retry penalty. Equal scores break by stable offer id, then target id.
Only retained Top-K candidates receive exact pathing. No unbounded sort or
per-candidate closure is allowed in the hot path.

Decision cadence is staggered by stable resident id. A resident normally
reconsiders no more than once per 30 ticks; exact dirty events for an emergency
need, invalid target, completed job or schedule boundary may wake it earlier.
At most two new resident decisions run in one tick, preventing synchronized
eight-resident spikes.

Required metrics include bucket candidate count, visited/scored/selected rows,
candidate/selected cap hits, exact paths requested, node expansions, stale
basis rejects, reservation conflicts, decision deferrals and reason code.

## 7. Pathing and reservation transaction

The claiming flow is ordered:

```text
indexed query -> capped score -> Top-K exact path
-> revalidate owner/path/schedule/capability basis
-> atomically acquire all claims
-> create/enter explicit JobCore driver
-> moving or working
```

Exact paths carry map, navigation, region, room and region-graph versions.
Stale results are discarded before job or claim mutation. The chosen path is
copied into a bounded typed route lane with a cursor; movement advances one or
more deterministic integer route steps according to the driver and updates
`LocationStore`. It never uses renderer interpolation as position.

Food, hauling, lamp and treatment drivers reserve all needed entity, cell,
quantity, capacity and interaction-spot claims in one transaction. Failed
acquisition leaves no partial claim. Cancellation/interruption after pickup
uses the existing return/rollback rules before terminal cleanup. Lease expiry
remains recovery metadata, never the normal release mechanism.

## 8. Work-kind integration

| Kind               | Existing asset to adapt               | PR-2 integration rule                                                       |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------- |
| eat                | M3 food availability + eating driver  | urgent hunger queries indexed food; reserve quantity/spot; consume once     |
| rest/sleep         | M3 rest candidate + rest driver       | schedule/weather/need/capability checked; reserve fixture/spot              |
| haul               | M2 storage logistics + hauling driver | supply/demand indexes; atomic quantity/capacity/spots; no global stack scan |
| lamp patrol/refill | M4 lamp network/gap + work offers     | route among dirty lamp targets; owner version checked before refill         |
| treatment          | M3 medical request + treatment driver | patient/caregiver ability basis; reserve stock/patient spot/cell            |
| wait               | autonomy store only                   | bounded retry/schedule wait with no fake job or retained claims             |

The PR-1 `GameSessionJobLifecycle` single resident/minimum cell claim becomes a
regression fixture after WM-0171. It must not coexist as a second product
autonomy authority.

## 9. Structured reason contract

A reason contains `code`, enumerated `source`, optional subject and target
entity refs, up to six ordered scalar parameters, owner/version basis and one
read-only inspection suggestion. Localized prose is client-owned.

Minimum required reason families:

| State/family | Example codes                                                                              | Suggestion                       |
| ------------ | ------------------------------------------------------------------------------------------ | -------------------------------- |
| idle         | `autonomy.idle.off_shift`, `autonomy.idle.no_indexed_offer`, `autonomy.idle.retry_backoff` | inspect schedule/resident        |
| need         | `need.hunger_emergency`, `need.rest_priority`, `need.safety_emergency`                     | inspect resident/resource        |
| capability   | `capability.movement_denied`, `capability.treatment_denied`, `capability.stale_basis`      | inspect capability               |
| offer        | `work_offer.empty_bucket`, `work_offer.stale_owner`, `work_offer.candidate_cap`            | inspect target                   |
| path         | `path.no_route`, `path.stale_basis`, `path.node_budget_exhausted`                          | inspect target                   |
| reservation  | `reservation.conflict`, `reservation.insufficient_amount`, `reservation.stale_target`      | inspect target/resource          |
| blocked      | `job.blocked.target_busy`, `job.blocked.material_missing`, `job.blocked.schedule_closed`   | inspect target/resource/schedule |
| failed       | `job.failed.target_destroyed`, `job.failed.resource_lost`, `job.failed.invariant`          | inspect target/resident          |
| interrupted  | `job.interrupted.need_emergency`, `job.interrupted.shift_end`, `job.interrupted.danger`    | inspect resident/schedule        |

Generic strings such as “no work”, “path failed” or “conditions not met” are
not sufficient. A suggestion navigates only to an existing inspector; it does
not execute work, change priority, reserve a target or create a PR-3 command.

## 10. Tick, pause and speed ownership

All simulation remains fixed at 30 logical ticks per world-second and 36,000
ticks per game day. Speeds change how many integer ticks the Worker requests per
wall-time quantum; they never change tick semantics.

The current PR-1 value `speed=3` was verified as a true 3x multiplier producing
90 TPS, not a level named “fast”. ADR-0018 therefore requires an explicit
schema-4 `speedMultiplier` contract rather than relabelling 3x.

| Control                  | Requested multiplier | Effective TPS | Ticks per 100-ms quantum |
| ------------------------ | -------------------: | ------------: | -----------------------: |
| pause (separate control) |       retained 1/2/4 |             0 |                        0 |
| 1x                       |                    1 |            30 |                        3 |
| 2x                       |                    2 |            60 |                        6 |
| 4x                       |                    4 |           120 |                       12 |

`SetSpeed` accepts only multipliers 1, 2 and 4. `Pause` is a separate boolean
control; zero is an effective paused rate, not a speed option.

Worker wall-time debt remains monotonic and bounded: no more than ten quanta
are dispatched in one scheduler callback and debt remains capped at the
reviewed 60,000 ms diagnostic boundary unless a later measured task tightens
it. Pause consumes wall cadence without advancing the world; resume does not
replay paused time. Shutdown/disconnect stops scheduling exactly once.

WM-0170/WM-0171 must stay speed-neutral and author behavior in ticks. WM-0172
alone performs the cross-package speed migration. UI timers, Promise waits,
advance/drain helpers and repeated commands cannot drive normal time.

## 11. Projection v2 boundary

ADR-0018 approves a future envelope schema 4 and GameSession projection v2,
implemented only by WM-0172. ProtocolVersion 1 and all message families remain.

Projection v2 must losslessly carry:

- all eight activity states and stable work kind;
- target entity and/or target cell;
- bounded route window, cursor, total steps and navigation basis;
- progress Q16, state-entered tick and driver step-entered tick;
- need/schedule/capability/offer/path/reservation/job decision versions;
- structured reason v2 and read-only inspection suggestion;
- selected resident's current schedule, shift, capability summary and priority
  need;
- explicit requested multiplier and effective TPS.

Render/UI pairs keep coherent tick, sequence, world/read-model hashes and owner
basis. Unknown v2 versions, malformed routes/reasons, wrong session or newer
incoherent data close the session. The default route never falls back to
`WEB_PRODUCT_GATE_READ_MODEL`.

WM-0172 atomically moves the default product negotiation to schema 4/v2. V1 may
exist only behind explicit same-build test/diagnostics entrypoints; the default
product module graph may not import or request it. It cannot represent or pass
PR-2 and retains its historical 0/1/2/3 behavior. V2 rejects speed multipliers
0 and 3 and accepts only 1/2/4; pause remains separate. Unknown/newer schema or
projection versions fail closed.

## 12. Pixi interpolation and HUD

Pixi retains the previous and current accepted authoritative render snapshots.
It interpolates only visual X/Y and animation phase. It must:

- clamp interpolation to the current publication interval;
- freeze at the current authoritative point while paused;
- snap on entity generation change, teleport flag, invalid previous basis or a
  route discontinuity after dropped snapshots;
- never modify `LocationStore`, route cursor, job state or progress;
- draw the authoritative route window, target marker, activity badge and work
  progress for relevant residents;
- keep movement across more than four tiles visible over multiple real frames
  at 1x and show at least two changing working projections.

React shows global time/speed and concise alerts, plus the selected resident's
current work, target, need/schedule/capability context, progress and structured
reason. It must not show every resident's full debug record at once. Idle,
blocked and failed residents expose a localized explanation and an inspector
link derived from the suggestion enum. Labels come from localization keys;
reason codes remain available as diagnostics but are not raw player prose.

Pause, 1x, 2x and 4x controls send the public Worker message by real input.
They do not directly tick the world. PR-2 adds no work-priority, direct-job,
blueprint, placement or build command.

## 13. Performance and allocation budgets

Correctness caps are mandatory, not benchmark hints:

- at most 24 visited, 12 retained and 4 exact paths per decision;
- at most two new resident decisions per tick;
- route authority capped at 128 cells and projection window at 32;
- reason parameters capped at six, resident rows at eight, current job markers
  at 32 and visible alerts at 16 for the gate scenario;
- dirty queues and reliable outboxes have explicit capacity/overflow reasons;
- no per-resident per-tick object, array, closure or string allocation in
  autonomy/driver hot paths.

Measured PR-2 budgets on the repository reference Windows/Chromium host:

- headless 36,000/100,000-tick GameSession tick P95 <= 4 ms and P99 <= 8 ms;
- real Worker at 4x reaches 120 effective TPS without monotonically growing
  scheduler debt, command queue, path queue or reliable outbox;
- default Web at eight residents has main-thread frame P95 <= 16 ms during the
  continuous capture;
- 100,000 ticks end with zero active terminal jobs/reservations, zero path or
  command backlog and zero resource conservation delta;
- a repeated full-day run has no monotonic heap/queue growth beyond a measured
  bounded warm-up allowance recorded by WM-0174.

If the reference host cannot meet an absolute budget, the task blocks with raw
measurements; it may not silently relax the cap or use fixture actors.

## 14. Three evidence lines

### Deterministic simulation

WM-0174 runs fixed seeds (including 5 and the M3 ordinary-life seed 46) for
36,000 ticks twice and compares checkpoint world/read-model hashes, transition
counts, resource conservation and reason traces. It also runs 100,000 ticks,
state/driver snapshot round trips, stale-basis rejection, contention cleanup,
cap metrics and performance budgets. Headless and Worker use the same runtime
advance surface.

### Real interaction and continuous capture

A real Chromium module Worker initializes once. The default Web product uses
real mouse/keyboard controls, not direct canvas `dispatchEvent`, to select
residents, pause/resume and switch 1x -> 2x -> 4x. After each deliberate control
input, time remains Worker-owned; no advance/wait/drain/command loop drives it.

One uninterrupted capture must include:

1. at least 30 seconds at 1x showing a route longer than four tiles and
   changing work progress;
2. a real pause/resume and one 2x observation segment;
3. a switch to 4x and continuation until the same session advances at least
   36,000 ticks;
4. at least three concurrent different work kinds;
5. selection of idle/blocked/failed residents with localized reason, target and
   suggestion;
6. eight residents/resources/details on one coherent session basis.

The durable WM-0174 artifact set contains the compressed continuous WebM,
capture manifest/checksum, browser-monotonic/tick timeline, state/work-kind
transitions, cadence/backpressure metrics and exact commands. Debug payload is
auxiliary only. Product-consumed observations are recorded after the actual
WorldReadModel reaches Pixi/HUD.

### Independent human/product observation

WM-0175 is owned by `gameplay-designer`, not an implementer. It watches a fresh
default product run and the continuous artifact without repository-internal
debug guidance. The observer must correctly identify what at least three
residents are doing, follow one resident's target/path/progress, explain one
idle/blocked/failed reason and operate pause/1x/2x/4x through real controls.

The read-only `reviewer` then independently verifies task evidence. An
implementer demonstration, screenshot, pre-recorded clip alone or debug JSON
cannot substitute. If the behavior is not understandable, WM-0175 requests a
repair task; it does not award `autonomous prototype` based on automation.

## 15. Reuse / adapt / retire / test-only inventory

| Asset                                                                        | Disposition for PR-2                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| PR-1 GameSession owner graph, hashes, command queue, Worker scheduler/outbox | Reuse; remain sole authority and time/delivery boundary                 |
| PR-1 eight-resident/resources/day-night initializer                          | Adapt into the full-day scenario; remove single-minimum-job assumptions |
| PR-1 `GameSessionJobLifecycle`                                               | Retire from default after WM-0171; retain focused regression only       |
| schema-3 projection v1                                                       | Test-only bridge during migration; cannot satisfy PR-2                  |
| WM-0168 real Worker/product-consumed collectors                              | Adapt for full-day 1x/2x/4x and richer state evidence                   |
| M1/M2 Entity/Map/Location/Spatial/Job/Reservation/Path/WorkOffer stores      | Reuse unchanged where possible; integrate through public owners         |
| M2 hauling/build drivers and storage logistics index                         | Adapt behind GameSession autonomy; historical scenarios remain tests    |
| M3 needs/urgency, day-night/schedule, ability cache                          | Reuse/adapt as authoritative decision inputs                            |
| M3 food/rest/medical candidate indexes and explicit drivers                  | Adapt; no scenario runner becomes product authority                     |
| M3 mood/relationship depth                                                   | Test-only for PR-2 unless required by a separate reviewed task          |
| M4 lamp network/gap/work surfaces                                            | Adapt for patrol/refill; Chronicle/obligation/crisis remain test-only   |
| M5 anomalies/factions and M8 seasons/endgame                                 | Test-only; not pulled into PR-2                                         |
| M6 static product fixture/review playback/smoke read model                   | Retire from default gameplay; diagnostics/tests only                    |
| M7 onboarding/release evidence                                               | Test/document reference only; no release readiness change               |
| focused M1-M8 save/replay envelopes                                          | Protected regression evidence only; not GameSession save                |
| Web/Pixi route/path/progress drawing scaffolds                               | Adapt after v2; any fixture/local prose authority is retired            |

## 16. Save, PR-3 and release boundaries

PR-2 authoritative stores and route/job state must be explicitly snapshot-
shaped so a later save design can include them, but this phase does not expose
`GameSessionSaveSnapshot`, load, player save UI, cross-version compatibility or
Web/Windows interoperability. RequestLoad remains unsupported/fail-closed.

PR-2 does not add player work priorities, direct assignment, context commands,
generic selection commands, blueprint placement, build orders or cancellation.
Speed and pause are session controls, not PR-3 work commands. Read-only reason
suggestions navigate to existing inspection surfaces only.

No release, Early Access, store, signing, telemetry, account, hosted service,
paid service, public feedback, public save or platform verdict action is
authorized.

## 17. Executable PR-2 DAG

```text
WM-0169
 -> WM-0170
 -> WM-0171
 -> WM-0172
 -> WM-0173
 -> WM-0174
 -> WM-0175
```

| Task    | Owner               | Write ownership                                                                                           | Exit purpose                                                |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| WM-0170 | simulation-engineer | new `sim-core` autonomy/reason/indexed-decision modules and tests                                         | explicit state/reason/Top-K/path/reservation contract       |
| WM-0171 | simulation-engineer | existing GameSession composition plus new autonomous-life integration, runner and tests                   | eight residents for 36,000 ticks with real drivers          |
| WM-0172 | simulation-engineer | sole `sim-protocol` schema/v2 writer, focused Worker host/mapper/browser files and exact core speed files | fail-closed v2 plus honest pause/1x/2x/4x                   |
| WM-0173 | client-engineer     | Web adapter/bootstrap, Pixi, focused HUD/localization and their tests                                     | product-consumed interpolation/path/target/progress/reasons |
| WM-0174 | qa-performance      | integration/E2E tests, artifacts and report only                                                          | automated full-day, performance and continuous evidence     |
| WM-0175 | gameplay-designer   | acceptance report/artifacts only                                                                          | independent human/product decision                          |

Every task remains proposed/unclaimed until WM-0169 is independently verified,
integrated and done. Dependencies are strictly serial, so maximum concurrent
write-heavy width is one. Later task checks reference only existing files or
self/ancestor outputs. Each task receives a separate independent `reviewer`;
product acceptance cannot be performed by an implementation owner.

## 18. Migration, rollback and stop lines

Migration:

1. WM-0170 implements protocol-neutral autonomy primitives.
2. WM-0171 composes historical stores/drivers into the GameSession and retires
   the PR-1 minimum lifecycle from the default route.
3. WM-0172 adds schema 4/v2, Worker/core-speed migration and the minimum default
   Web negotiation cutover; any v1 bridge is test/diagnostics-only.
4. WM-0173 consumes the already-default v2 route and implements read-only
   Pixi/HUD presentation and real controls.
5. WM-0174 proves the integrated path; WM-0175 decides product acceptance.

Rollback occurs one reviewed task at a time. Once WM-0172 integrates, default
Web is already schema 4/v2; its test/diagnostics-only v1 bridge may never back
the product. Rolling back WM-0172 or any later consumer restores Worker and Web
together to the last reviewed schema-3/v1 PR-1 build; mixed schemas are not
supported. Rollback never restores static fixture authority or UI-driven time.

Stop and create a repair task if any of these occur:

- actor thinking scans all entities/cells or exceeds a documented cap;
- two stores own the same job, reservation, route or position fact;
- a path/result basis is used after owner/navigation change;
- UI synthesizes work/path/reason truth or delays a completed job to look busy;
- 4x is only a relabelled 3x or creates unbounded scheduler debt;
- default Web falls back to a fixture after protocol/session failure;
- full-day determinism, cleanup, conservation, performance or human
  comprehension fails;
- implementation needs a new command/save surface not approved here.

WM-0154 remains a blocked historical evidence task. Its old static/focused
scope is not resumed by PR-1 and cannot substitute for WM-0174/WM-0175.
