# WM-0072 Owner Plan And Architecture Self-Check

## Source Documents Read

- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `AGENTS.md`
- `CODEX_START_HERE.md`
- `PLANS.md`
- `coordination/tasks/WM-0072.json`
- `coordination/reports/WM-0071.md`
- `coordination/reports/WM-0071-future-m5-entry-prompt.md`
- `docs/00_project/05_decision_register.md`
- `docs/02_systems/07_chronicle_evidence_knowledge.md`
- `docs/02_systems/08_anomalies_rules_investigation.md`
- `docs/02_systems/09_obligations_pacts_factions.md`
- `docs/02_systems/10_ordinances_governance_identity.md`
- `docs/02_systems/11_story_director_incidents_quests.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/02_systems/18_m4_core_vertical_slice_scenario.md`
- `docs/03_world/03_factions.md`
- `docs/03_world/05_supernatural_taxonomy.md`
- `docs/04_content_balance/00_content_design_guide.md`
- `docs/04_content_balance/04_anomaly_authoring_guide.md`
- `docs/04_content_balance/05_incident_authoring_guide.md`
- `docs/04_content_balance/08_sample_content_catalog.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/05_tech/07_architecture_decision_records.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/03_future_content_backlog.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `docs/08_codex/08_spark_execution_lane.md`
- `coordination/decisions/ADR-0001.md` through
  `coordination/decisions/ADR-0009.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `.agents/skills/wuming-town-agent-workflow/assets/report-template.md`

## Startup Audit

- Branch is `task/WM-0072-create-m5-planning-package`.
- Initial workflow validation passed before claim: 72 tasks, 10 roles.
- Initial workflow status before claim: 1 ready task (`WM-0072`) and 71 done
  tasks; 0 unread inbox messages.
- `WM-0072` was claimed by `systems-architect` with thread label
  `Compass WM-0072 M5 planning`.
- The promoted `coordination/tasks/WM-0072.json` packet was untracked in Git
  at startup and was preserved; no existing changes were reverted.
- WM-0072 edits are planning/control-plane only. No `packages/**`, `apps/**`,
  `tools/**`, manifests, lockfiles, runtime implementation, tests, benchmark
  baselines, public Worker protocol, public save format, content schema
  implementation, dependencies, or M6 tasks are edited by this plan.

## M4 Baseline Evidence

M4 closeout is the protected baseline for M5:

- Scenario id: `m4.core_vertical_slice.borrowed_shadow_lamps.v1`
- Alias: `m4-core-vertical-slice`
- Requested seed: `4`
- Authoritative scenario seed: `50`
- Content hash: `0x698f2c41`
- Command stream hash: `0x538d0e43`
- 36000-tick final world hash: `0xc201a925`
- 36000-tick scenario read-model hash: `0xce261d9d`
- 100000-tick final world hash: `0xdafa3b25`
- 100000-tick scenario read-model hash: `0xa896439d`
- M4 benchmark final world/read-model hashes:
  `0xdafa3b25` / `0x08dd9343`
- Focused save tick/load tick: `12000` / `12001`
- M4 focused save bytes: `8124`
- M4 focused save first divergent tick: `null`
- Worker parity checkpoint count: `6`
- Worker parity first mismatched checkpoint tick: `null`
- Reviewed benchmark artifact:
  `coordination/artifacts/WM-0070/benchmarks/benchmark-results.json`
- Reviewed artifact file SHA-256:
  `FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`
- Canonical benchmark payload SHA-256:
  `B406B940AA8C55531DD9A8A47EEF4C248C1761E471B1D5B2D611491256370293`

M0-M4 regression protection stays explicit. The M3 baseline remains protected,
including scenario id `m3.ordinary_life.injured_caregiver.v1`, final world hash
`0x7eb81a69`, final benchmark read-model hash `0x82bf87d6`, and reviewed
benchmark artifact SHA-256
`63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`.

The benchmark policy is unchanged: P95 regression over 10 percent requires
explanation, and over 20 percent blocks merge by default.

## M5 Objective

M5 creates the alpha content framework: three reusable anomaly rules, faction
and governance hooks, a first season/event pool, data-only mod validation,
integrated content catalog expectations, focused save/replay, Worker
projections, benchmark/invariant evidence, and M6 readiness stop signs.

The planning package adopts the WM-0071 future M5 entry prompt. It does not
implement runtime M5 behavior.

## Planning Decisions

- Scenario contract:
  `docs/02_systems/19_m5_alpha_content_framework_scenario.md` with scenario id
  `m5.alpha_content_framework.first_season.v1`.
- Architecture gate: `coordination/decisions/ADR-0010.md`.
- Roadmap plan: `docs/07_roadmap/10_m5_alpha_content_framework_plan.md`.
- Proposed downstream packets: WM-0073 through WM-0083.
- Three anomaly rules for alpha content framework scope:
  `core.anomaly.borrowed_shadow.v1`, `core.anomaly.third_knock.v1`, and
  `core.anomaly.old_bridge_guest.v1`.
- Faction/governance hooks are scoped to facts and policy hooks for
  Patrol Registry Office, Nine Inns Guild, Mountain Contract Families, Night
  Market Guests, Return-Lamp Society, and town council posts; M5 does not
  implement full campaign politics.
- Season/event pool scope is one deterministic first-season pool with bounded
  incidents, cooldowns, recovery windows, and content validation evidence; it
  is not an endless live-service event generator.
- Data-mod policy is data-only. Arbitrary code mods, network access and
  platform APIs remain forbidden.
- M6 readiness is stop-sign evidence only. M5 does not create, promote, claim,
  implement, or review M6 work.

## Architecture Boundaries Preserved

- Authority remains Simulation Worker or Node headless only.
- UI, Pixi, React, Electron, overlays, read models, and Worker projection
  consumers remain read-only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time, and ambient randomness.
- Content definitions compile to stable ids and integer rule inputs. Runtime
  owner stores hold mutable facts.
- Actor, anomaly, faction, governance, incident, and director choices use
  bounded indexed candidates and stable Top-K ordering.
- Crisis and job progress stay explicit serializable state.
- Failures use structured reason codes and bounded traces.
- Derived indexes, content projections, read models, season queues, and mod
  diagnostics are versioned, scratch, or rebuilt from owner stores.
- Focused M5 save/replay and Worker parity are milestone gates, not public save
  compatibility or public protocol redesign.

## Acyclic DAG Check

The proposed dependency order is:

`WM-0072 -> WM-0073 -> WM-0074 -> WM-0075 -> WM-0076 -> WM-0077 -> WM-0078 -> WM-0079 -> WM-0080 -> WM-0081 -> WM-0082 -> WM-0083`.

All edges point from lower IDs to higher IDs. The graph is acyclic.

## Block Conditions For Downstream Owners

Downstream M5 owners must block before implementation if they need:

- a mutable M5 fact without a named owner store;
- normal-tick full-map, all-entity, all-anomaly, all-faction, all-rule,
  all-event, all-building, all-content-def, all-save, or all-projection scans;
- an unversioned cache, content row, derived index, read model, season queue,
  save diagnostic, Worker projection, or UI surface as authority;
- direct director mutation of owner facts;
- public Worker protocol changes, public save compatibility, content schema
  implementation outside the owning task, codec/dependency/package-boundary
  changes, platform save UI, or product packaging work;
- UI-owned simulation state or client-side repair of authoritative facts;
- real time, ambient randomness, thread scheduling, hidden shared state, or
  Promise/coroutine/closure execution state;
- content definitions that require bespoke runtime code per item instead of
  reusable rule components;
- code mods, network mods, platform API mods, unsafe paths, oversized assets,
  Zip Slip exposure, recursive archive expansion, or missing schema validation;
- M6 product gate work, public release compatibility promises, storefront,
  crash reporting, packaging, accessibility closeout, or external playtest
  scope.

## Performance And Invariant Plan

M5 metrics and invariants add content-framework evidence without weakening
thresholds. The M5 benchmark task must report:

- anomaly roster count, active anomaly count, activation candidate visits,
  transition counts, terminal reason counts, and per-rule cap hits;
- Chronicle evidence row counts, support candidate visits, contradiction
  status, confirmed-rule counts, dissemination backlog, and rule-regression
  evidence;
- faction/governance fact counts, policy hook candidate visits, obligation
  pressure inputs, legitimacy/conflict counts, and exact owner-version bases;
- season/event pool candidate counts, cooldown rejections, recovery windows,
  incident precondition failures, and event freshness counters;
- content schema validation counts, rejected def counts, reference errors,
  semantic errors, localization errors, mod manifest hash, and compiled
  DefIndex stability evidence;
- focused save bytes, load validation time, content manifest hash, rebuilt
  surface count, first resumed hash, and first divergent tick;
- Worker snapshot/read-model/projection bytes, stale projection rejects, and
  parity checkpoint hashes;
- M0-M4 regression results, benchmark threshold comparison, and M6 readiness
  stop-sign verdict.

Invariant failures must cover M0-M4 regression, content validation drift,
schema/version mismatch, unsafe mod input acceptance, anomaly state leaks,
faction/governance hidden authority, event pool queue growth, invalid
director/direct-fact mutation, save/replay divergence, Worker projection
staleness, UI authority, threshold weakening, and M6 task creation.

## Save And Worker Policy

M5 save/replay is focused to `m5.alpha_content_framework.first_season.v1`.
It may snapshot content manifest identity, compiled DefIndex hashes, approved
M5 owner facts, deterministic stream positions, command tail, bounded trace
diagnostics, and read-only projection hashes.

It does not approve public save compatibility, platform save UI, public schema
migrations, codec dependencies, or cross-version compatibility promises. Load
must validate external content/mod inputs as `unknown`, fail closed on unsafe
or unsupported versions, rebuild derived content/anomaly/faction/season/Worker
surfaces before the first resumed tick, and produce structured divergence
diagnostics.

Worker projections remain read-only and should reuse existing message families
where feasible. Any new public protocol family, schema version, or client-side
authority path blocks for a separate reviewed gate.

## Data-Mod Policy

M5 allows data mods only through manifest, path safety, size limits, schema
validation, dependency/reference validation, semantic validation, localization
coverage, deterministic compile order, scenario validation, design review and
culture/fairness review where applicable.

Arbitrary JavaScript, TypeScript, WebAssembly, native code, network access,
platform APIs, executable scripts, remote URLs, and install-time effects remain
forbidden. Invalid content fails before reaching runtime owner stores.

## M6 Readiness Stop Signs

M5 cannot advance toward M6 planning if any of these remain unresolved:

- M5 content additions require bespoke runtime code per item.
- The first-season pool cannot run long enough to show 10 in-game hours without
  structural deadlock, unbounded queue growth, or hidden global scans.
- Fewer than four strategy families can survive in benchmarked scenarios.
- Save/replay or Worker parity cannot include content manifest and projection
  basis evidence.
- Data mods can reach runtime without schema/reference/semantic/localization
  validation.
- Public save compatibility, Worker protocol redesign, platform packaging,
  crash reporting, accessibility closeout, or external playtest needs are still
  implicit rather than separately planned.
- Benchmark thresholds or M0-M4 regression gates are weakened to make content
  pass.

## Spark Classification

WM-0072 is not Spark-eligible. It is architecture/control-plane work that
defines ADR ownership, content-schema policy, save/replay scope, Worker
projection expectations, benchmark policy and downstream task DAG.

Downstream tasks WM-0073 through WM-0083 are also marked not Spark-eligible by
default because they touch architecture, schema, simulation ownership,
save/replay, Worker parity, benchmarks or milestone readiness. A later tiny
data fixture or documentation repair may be split only if it gets its own task
and satisfies the Spark classifier.

## Checks

Final check output is recorded in `coordination/reports/WM-0072.md`.
