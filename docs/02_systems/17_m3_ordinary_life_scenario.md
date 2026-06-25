# M3 Ordinary-Life Scenario Contract

Status: proposed contract for WM-0046 review. This document defines executable
scenario requirements only. It does not approve architecture, implementation,
public save format, Worker protocol, schemas, dependencies, UI, benchmark
baselines, M4 systems, or content production.

## Scenario Identity

- Scenario id: `m3.ordinary_life.injured_caregiver.v1`
- DAG role: required contract input for `WM-0047`; implementation evidence is
  expected from `WM-0056`, save/replay from `WM-0057`, Worker parity from
  `WM-0058`, benchmarks from `WM-0059`, and closeout from `WM-0060`.
- Primary seed: `46`
- Secondary regression seeds: `4601`, `4602`
- Random streams: `world-generation`, `weather:m3-ordinary-life`,
  `social:m3-ordinary-life`, and `incident:m3-ordinary-life-sprain`.
- Fixed tick rate: 30 TPS.
- Day length: `TICKS_PER_DAY = 36_000`.
- Start tick: `0`, interpreted as 06:00 dawn on game day 0.
- Short horizon: `12_000` ticks, through late morning.
- Full scenario horizon: `36_000` ticks, one complete game day.
- Long invariant horizon: `100_000` ticks for benchmark and drift checks.
- Save checkpoints: `0`, `3_600`, `7_200`, `12_000`, `18_000`, `36_000`.
- Resume gate: save at `12_000`, load at `12_001`, continue to `36_000`.

All values above are contract constants for this scenario. Balance magnitudes
below are provisional M3 test values, not final game balance.

## Fixture Bounds

The fixture is intentionally small so implementation can prove deterministic
composition before broader content exists.

| Surface | Bound |
|---|---:|
| Map cells | 32 x 24 |
| Regions | 4 named regions |
| Actors | 6 residents |
| Item stack defs | 5 |
| Storage slots | 8 |
| Work offer rows | <= 24 active |
| Active jobs | <= 8 |
| Active reservations | <= 24 |
| Health conditions | <= 6 |
| Mood thoughts | <= 24 retained |
| Relationship edges | <= 10 |
| Reason traces | <= 64 retained |

Regions:

- `old_relay_yard`: meeting, cooking, and handoff area.
- `east_granary_lane`: grain sacks, simple workshop task, and sprain site.
- `returning_lamp_lane_clinic`: clinic and rest mat area. The area name is
  world flavor only in M3; no lamp network, lamp fuel, or lamp boundary
  mechanics are simulated.
- `north_field_edge`: daytime-only field work area with basic weather exposure.

The fixture may include static safe-region tags that prevent ordinary residents
from selecting out-of-bounds work. Those tags are not M4 lantern boundaries and
must not create lamp, Chronicle, obligation, anomaly, or crisis state.

## Actors

Actors are stable-sorted by actor id for all owner-store iteration, work
selection, relationship updates, and reason trace emission.

| Actor id | Role | Initial abilities | Initial needs | Relationship facts |
|---|---|---|---|---|
| `actor.yao` | field hand, patient | movement 900, manipulation 850, stamina 760 | hunger 320, rest 420, comfort 650, social 520, safety 700 | sibling of `actor.lin`, trusts `actor.min` 260 |
| `actor.lin` | cook and sibling | movement 850, manipulation 820, stamina 700 | hunger 360, rest 500, comfort 680, social 560, safety 720 | sibling of `actor.yao`, respect toward `actor.min` 180 |
| `actor.min` | physician | movement 800, manipulation 920, communication 900, stamina 650 | hunger 390, rest 530, comfort 640, social 470, safety 760 | trusted by Yao and Lin |
| `actor.qiu` | hauler | movement 920, manipulation 760, stamina 780 | hunger 340, rest 460, comfort 620, social 430, safety 690 | neighbor of Yao |
| `actor.ren` | steward | communication 850, stamina 620 | hunger 410, rest 560, comfort 700, social 540, safety 760 | work authority for granary tasks |
| `actor.su` | elder witness | movement 520, sight 620, communication 700 | hunger 430, rest 600, comfort 580, social 610, safety 730 | mentor edge to Min |

Need and ability lanes use the 0-1000 integer scale. Relationship dimensions
are separate integer lanes; favor/trust/respect use -1000 to 1000. No actor
identity, relation, or testimony data may depend on UI text.

## Initial Facts And Command Stream

The scenario is data-driven. It can be built from staged initial facts plus a
small deterministic command stream. Commands are simulation inputs only; UI
shortcuts or developer consoles cannot mutate authority directly.

Initial facts at tick `0`:

- Time is dawn, weather is `dry_cool`.
- Food stock: `grain_bowl` x 8, `bean_soup` x 3, `clean_water` x 6.
- Medical stock: `bandage` x 3, `herb_poultice` x 2.
- Work offers: `field_tend`, `grain_carry`, `cook_breakfast`,
  `clinic_prepare`, and `rest_spot_available`.
- Rest fixtures: 2 clinic mats and 2 home bedrolls.
- No active injury, no active illness, no active M4 fact.

Command stream:

| Tick | Command | Expected effect |
|---:|---|---|
| 0 | `scenario.start` | Initializes fixture with seed `46` and stable content hash. |
| 900 | `assign.work(actor.yao, field_tend)` | Yao may select field work if needs and path permit. |
| 1_800 | `assign.work(actor.lin, cook_breakfast)` | Lin starts breakfast logistics if food is available. |
| 2_400 | `scenario.inject_injury(actor.yao, left_leg_sprain)` | Adds deterministic sprain fact from incident stream. |
| 2_430 | `request.medical(actor.yao)` | Creates patient-side medical offer after ability invalidation. |
| 3_000 | `weather.force(rain_light)` | Basic weather owner state changes by command for determinism. |
| 6_000 | `assign.work(actor.qiu, grain_carry)` | Qiu should consider logistics, weather, hunger, and reservation state. |
| 7_200 | `meal.window(midday)` | Hunger-driven eating can compete with work through bounded indexes. |
| 12_000 | `checkpoint.save` | Focused M3 snapshot is captured for resume gate. |
| 18_000 | `time.window(evening)` | Rest, mood, and social consequences should be visible. |
| 36_000 | `scenario.end_day` | Full-day evidence checkpoint. |

The injury injection is allowed because this is a deterministic scenario
command. Runtime systems must still express the resulting condition through
normal health, ability, work, medical, mood, relationship, and reason surfaces.

## Required Behavior

### Needs, Food, And Rest

- Hunger, rest, comfort, social, and safety update on scheduled phases with
  stable entity staggering; no all-pawn same-tick thinking burst.
- Hunger below 300 creates eating urgency; hunger below 180 can interrupt
  ordinary work at a safe point unless medical emergency has higher priority.
- Rest below 260 creates rest urgency; rest recovery requires a reserved valid
  rest fixture and an explicit serializable rest or sleep job.
- Eating consumes one integer food portion exactly once through item and
  reservation owner state.
- Lin's cooking creates an explainable food availability improvement but cannot
  fabricate food without stock.
- Rain lowers comfort and increases rest cost for exposed outdoor work by
  provisional values only; final balance remains open.

### Injury, Illness, Medical Care, And Abilities

- At tick `2_400`, Yao receives `condition.left_leg_sprain` with severity 420,
  source `incident:m3-ordinary-life-sprain`, body part `left_leg`, and age 0.
- The sprain invalidates movement and stamina ability cache entries before any
  new work selection can use stale values.
- Yao's movement ability must drop below the threshold for `field_tend` and
  `grain_carry`, causing current or next work to fail or interrupt with a
  structured reason.
- Medical care creates a patient offer and a caregiver work offer. Min can
  treat if path, skill, stock, patient state, and reservations allow it.
- Treatment uses explicit job states. It reserves patient interaction, medical
  stock, and treatment cell before applying condition delta.
- Successful treatment consumes one `bandage` or `herb_poultice` unit and
  reduces sprain severity by a deterministic integer delta.
- Illness must be present as a basic negative control: Su starts with no
  disease; one optional `mild_cough` fixture may be enabled only in secondary
  seeds. It must not be required for the primary success path.
- A diagnosis trace must include at least one clue and one counterevidence
  entry, for example `clue.limp_observed` and
  `counterevidence.no_fever_detected`. These are ordinary medical facts, not
  Chronicle evidence gameplay.

### Mood, Thoughts, And Relationships

- Yao receives a negative thought from pain, lost work, and wet weather, each
  with bounded duration and integer strength.
- Lin receives a concern thought when Yao becomes a patient and a relief thought
  if treatment succeeds.
- Min receives a duty or confidence thought when treatment completes; failure
  must explain missing stock, path, ability, or reservation causes.
- Relationship edges update from structured social events:
  `care_received`, `meal_shared`, `work_burden_shifted`, or
  `care_delayed`.
- At least one relationship lane between Yao and Min or Yao and Lin changes by
  the end of the short horizon.
- Social consequences must not be arbitrary stat bonuses. They must reference
  the source event id, source tick, affected actor ids, lane, delta, and reason
  code.

### Day/Night And Weather Basics

- Hour of day derives only from tick and `TICKS_PER_DAY`.
- Dawn, daytime, evening, and night schedule windows can alter work eligibility
  and need rates. They cannot read real time.
- Weather uses the named scenario weather stream or explicit scenario command.
  Visual-only randomness cannot affect weather authority.
- Rain at tick `3_000` must affect outdoor work context, comfort, path/work
  explanations, and mood context.
- Night after tick `19_500` reduces ordinary outdoor work eligibility for this
  fixture. It does not activate M4 anomalies, crisis chains, lamp systems, or
  director logic.

### Work, Logistics, And Noncombat Resolution

- The injury shifts work capacity away from Yao and toward available residents
  through indexed work offers and Top-K candidate selection.
- Qiu or Lin may carry food or medical stock only through existing logistics,
  reservation, and explicit job state principles.
- The required resolution is noncombat: rest, food, care, schedule change,
  stock logistics, and social support. Combat, hostile encounters, anomaly
  suppression, or director crisis resolution are out of scope.
- Every failed work, rest, eating, or treatment selection must leave no partial
  reservation and must emit a structured reason.

## Expected Structured Reasons

Exact enum names may be finalized by `WM-0047`, but implementations must expose
equivalent machine-readable reason classes. Tests must assert reason classes,
not prose strings.

Required success reasons:

- `scenario.initialized`
- `need.hunger_urgency_indexed`
- `need.rest_urgency_indexed`
- `food.consumed_integer_portion`
- `condition.injury_applied`
- `ability.cache_invalidated`
- `work.interrupted_by_ability_change`
- `medical.offer_created`
- `medical.treatment_completed`
- `mood.thought_added`
- `relationship.event_applied`
- `weather.changed_by_command`
- `save.checkpoint_written`
- `replay.hash_match`
- `worker_parity.hash_match`

Required rejection or counterevidence reasons:

- `work.rejected_actor_ability_below_threshold`
- `work.rejected_outdoor_night_window`
- `work.rejected_weather_exposure`
- `reservation.item_quantity_conflict`
- `reservation.interaction_spot_conflict`
- `reservation.insufficient_amount`
- `path.no_route_to_patient`
- `medical.rejected_no_stock`
- `medical.rejected_patient_not_injured`
- `medical.counterevidence_no_fever`
- `food.rejected_no_available_portion`
- `rest.rejected_no_reserved_fixture`
- `job.interrupted_safe_point`
- `job.interruption_denied`
- `trace.candidate_cap_reached`
- `snapshot.rebuilt_derived_indexes`

Each retained ReasonTrace row must include scenario id, seed, tick, actor id
when applicable, system id, candidate counts, cap values, selected target if
any, reason class, and source owner-store version basis where relevant.

## Invariants

The primary scenario and long-run horizon must assert these invariants:

- Same build, content hash, scenario id, seed, and command stream produce the
  same checkpoint hashes.
- All authoritative mutation occurs in Simulation Worker or Node headless.
- No UI, Pixi, React, Electron, platform save UI, or render projection mutates
  world state.
- No actor thinking path scans all map cells, all entities, all work offers, all
  conditions, or all relationship edges.
- Candidate reads use indexed buckets and documented caps.
- Jobs store explicit serializable state only.
- Active reservations return to zero at terminal checkpoints unless a checkpoint
  explicitly records a running job.
- Item portions and medical stock are conserved as integer quantities.
- Need, mood, ability, condition severity, and relationship lanes remain within
  documented integer ranges.
- Ability cache entries are invalidated on condition changes and do not diverge
  from owner condition facts.
- Derived indexes, read models, path caches, WorkOffer rows, and UI projections
  rebuild from owner stores and never become save authority.
- Reason traces are capacity bounded and cannot grow with elapsed ticks.
- Save/load/resume hash equals uninterrupted replay at all post-load
  checkpoints.
- Browser Worker and Node headless authoritative hashes match for the same
  checkpoints.
- No M4 lamp network, Chronicle knowledge, obligation, anomaly, crisis chain,
  story director, dawn replay productization, or direct product UI state is
  created, mutated, saved, or required.

## WM-0056 Executable Scenario Evidence

WM-0056 implements the Node/headless executable vertical slice for scenario
alias `m3-ordinary-life`, backed by scenario id
`m3.ordinary_life.injured_caregiver.v1`. The focused run composes the reviewed
M3 owner stores for needs, environment, rest/sleep, food/eating, health and
ability cache, medical care, mood/thoughts, relationship events, reservations,
and job core state.

For the primary CLI smoke (`pnpm sim:run -- --seed 3 --scenario
m3-ordinary-life --ticks 20000`), the run records requested seed `3` but uses
the contract primary seed `46` as the authoritative scenario seed initialized
by `scenario.start`. It emits command hash `0x226832d2`, content hash
`0xdfe7107e`, world hash `0x7b37ff29`, checkpoint hashes, bounded reason
traces, queue metrics, terminal invariant counters, and replay evidence. The
`12000` and `20000` tick runs share prefix checkpoint hashes at ticks `0`,
`3600`, `7200`, and `12000`. The run ends with zero active reservations, zero
running jobs, one completed treatment, one integer food portion consumed, one
bandage consumed, Yao movement reduced from injury then improved by treatment,
rain/night work rejection context, relationship changes for care and gratitude,
and owner-derived terminal checks covering 30 need lanes, 36 mood lanes, 15
relationship lanes, and 5 explicit M4 absence checks. This is implementation
evidence for WM-0056 only; focused save/load resume, Worker parity, benchmark
baselines, and M4 systems remain in downstream tasks.

## Save, Replay, And Worker Parity

Focused M3 save/replay may extend the existing focused harness model only after
`WM-0047` approves owner-store scope. This contract does not approve a public
save container or migration.

Save/replay checkpoints must record:

- scenario id, seed, content hash, command stream hash, current tick;
- owner-store snapshots for the approved M3 owner facts;
- random stream states;
- job and reservation owner state;
- compact reason and metrics summaries needed for diagnostics;
- read-only projection hashes for comparison only.

Load must validate shape and integer ranges before mutating the target world,
then rebuild derived indexes before the first resumed tick. Divergence output
must name scenario id, seed, checkpoint tick, first mismatched hash, section
summary, and artifact paths.

Worker parity must compare Node headless and browser Worker authoritative
hashes at `0`, `3_600`, `7_200`, `12_000`, `18_000`, and `36_000`. Worker
read models are read-only and may report snapshot size, latency count, and
projection hash, but they cannot repair, override, or author authoritative
state.

## Benchmark Dimensions

`WM-0059` must turn these dimensions into reviewed artifacts and baselines. This
task only defines dimensions.

- Scheduled need update count, per-system cost, and stagger distribution.
- Work/need/medical/social indexed bucket sizes and candidate cap hits.
- Exact path requests, stale path basis rejects, and node-budget rejects.
- Reservation active count, failed transaction count, and terminal leak count.
- Job state count by kind and terminal reason.
- Condition update count, ability cache invalidations, and ability query cost.
- Food and medical integer stock conservation.
- Thought generation count, retained thought count, and trace capacity use.
- Relationship event count and edge count.
- Weather and day/night scheduled update cost.
- Snapshot byte size, rebuild time, command log size, and resume comparison
  cost.
- Worker parity latency count, snapshot/read-model sizes, and hash comparison
  cost.
- Long-run drift surfaces: queue lengths, stale offers, cache divergence,
  negative lanes, unbounded trace growth, and hash divergence.

## Non-Goals

- No architecture decision record is created here.
- No implementation, tests, benchmarks, schemas, protocols, runtime packages,
  package boundaries, or dependencies change here.
- No public save compatibility promise, migration function, platform save UI,
  or broad Save Container version is approved here.
- No broad economy, production catalog expansion, content localization, event
  pool, tutorial, or product UI work is approved here.
- No combat resolution is required or accepted as the main path.
- No prose-only event may satisfy a required behavior; every outcome must map
  to owner facts, command input, structured reasons, and testable invariants.

## Explicit M4 Exclusions

M3 ordinary life must protect future M4 pillars by not implementing them early
or reducing them to ordinary stat effects.

- Lantern boundaries: no lamp network, lamp fuel pressure, lit-domain rules,
  dusk checklist product loop, or lantern-based anomaly containment. Static
  region safety tags may exist only as ordinary fixture bounds.
- Chronicle knowledge: no Chronicle evidence graph, rule discovery, testimony
  credibility gameplay, dawn replay, archive damage, or player-facing case
  board. Medical clues and counterevidence are local health facts only.
- Obligations: no old debt, vow, town-law, inherited duty, faction obligation,
  or director pressure system. Relationship events are ordinary social facts
  only.
- Anomalies and crises: no strange visitors, crisis chains, anomaly rules,
  supernatural illness explanation, or story director escalation.
- Product direction: no M4 task creation, promotion, claim, implementation, or
  integration is authorized by this scenario.
