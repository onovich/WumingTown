# WM-0061 Owner Plan And Architecture Self-Check

## Source Documents Read

- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `AGENTS.md`
- `CODEX_START_HERE.md`
- `coordination/tasks/WM-0061.json`
- `coordination/reports/WM-0060-future-m4-entry-prompt.md`
- `docs/00_project/05_decision_register.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/02_systems/07_chronicle_evidence_knowledge.md`
- `docs/02_systems/08_anomalies_rules_investigation.md`
- `docs/02_systems/09_obligations_pacts_factions.md`
- `docs/02_systems/10_ordinances_governance_identity.md`
- `docs/02_systems/11_story_director_incidents_quests.md`
- `docs/02_systems/12_combat_security_night_watch.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/02_systems/14_explainability_debug_observability.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/08_m3_ordinary_life_simulation_plan.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `docs/08_codex/08_spark_execution_lane.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `.agents/skills/wuming-town-agent-workflow/assets/report-template.md`
- `templates/ADR.md`

## Startup Audit

- Branch is `task/WM-0061-create-m4-planning-package`.
- `WM-0061` was already `in_progress` and claimed by `systems-architect`.
- Initial taskctl gate passed: 61 tasks, 10 roles, zero unread inbox messages.
- Existing pre-work coordination state included an untracked
  `coordination/tasks/WM-0061.json` packet and a modified
  `coordination/thread-registry.json` entry for the active systems-architect
  thread. These were preserved.
- No product runtime, tests, packages, apps, tools, manifests, save format,
  Worker protocol, schema, dependency, benchmark baseline, or M5 file was
  edited for WM-0061.

## M3 Baseline Evidence

M3 is the protected baseline for M4:

- Scenario id: `m3.ordinary_life.injured_caregiver.v1`
- Requested seed: `3`
- Authoritative scenario seed: `46`
- Command stream hash: `0x226832d2`
- Content hash: `0xdfe7107e`
- Long-run final world hash: `0x7eb81a69`
- Final benchmark read-model hash: `0x82bf87d6`
- Save tick/load tick: `12000` / `12001`
- Worker parity checkpoints: `0`, `3600`, `7200`, `12000`, `18000`, `36000`
- Benchmark artifact:
  `coordination/artifacts/WM-0059/benchmarks/benchmark-results.json`
- Benchmark artifact SHA-256:
  `63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`

M4 planning explicitly keeps the existing benchmark policy: P95 regression over
10 percent requires explanation, and over 20 percent blocks merge by default.

## Planning Decisions

- Scenario contract:
  `docs/02_systems/18_m4_core_vertical_slice_scenario.md` with scenario id
  `m4.core_vertical_slice.borrowed_shadow_lamps.v1`.
- First rule to prove: a borrowed shadow can only take a stable identity from a
  person crossing an unclaimed dusk lamp gap without a confirmed Chronicle
  identity record; maintained linked lamps plus confirmed name evidence prevent
  the claim.
- Architecture gate: `coordination/decisions/ADR-0009.md`.
- Roadmap plan: `docs/07_roadmap/09_m4_core_vertical_slice_plan.md`.
- Proposed downstream packets: WM-0062 through WM-0071.
- Final M4 packet: `WM-0071`, which must close M4 and write
  `coordination/reports/WM-0071-future-m5-entry-prompt.md` as a
  non-executable future handoff. It must not create or implement M5 tasks.

## Architecture Boundaries Preserved

- Authority remains Simulation Worker or Node headless only.
- UI, Pixi, React, Electron, overlays, and read-model consumers remain
  read-only.
- `sim-core` purity, fixed 30 TPS, seeded random streams, stable ordering,
  integer/fixed-point semantics, bounded indexed thinking, serializable jobs
  and crisis state, structured reasons, save/replay, Worker parity and
  independent review are explicit gates.
- M4 owner surfaces are split across lamp network, Chronicle evidence,
  knowledge dissemination, obligations, town rules, borrowed-shadow crisis,
  director pressure/recovery, ReasonTrace, focused save/replay and Worker
  projections.
- Director recovery windows can schedule legal commands and expose repair
  opportunities, but cannot mutate facts directly or erase consequences.

## Acyclic DAG Check

The proposed dependency order is:

`WM-0061 -> WM-0062 -> WM-0063 -> WM-0064 -> WM-0065 -> WM-0066 -> WM-0067 -> WM-0068 -> WM-0069 -> WM-0070 -> WM-0071`.

All edges point from lower IDs to higher IDs. The graph is acyclic.

## Block Conditions For Downstream Owners

Downstream owners must block before implementation if they need:

- a mutable M4 fact without a named owner store;
- a normal-tick full-map, all-entity, all-lamp, all-evidence, all-obligation,
  all-crisis, all-incident, all-job or all-projection scan;
- an unversioned cache, derived index, read model, dawn review row or UI
  projection as authority;
- direct director mutation of lamp, evidence, obligation, town-rule, health,
  relationship, crisis, resource, death or recovery facts;
- public Worker protocol, public save compatibility, schema migration, codec,
  package-boundary change, new runtime dependency or platform save UI;
- UI-owned simulation state or client-side repair of authoritative facts;
- real time, ambient randomness, thread scheduling or hidden shared state;
- coroutine, Promise, closure, UI-local or thread-local execution progress;
- M5 content framework, broad anomaly roster, faction campaign, season event
  pool, data-mod production or M5 task creation.

## Performance And Invariant Plan

M4 metrics and invariants must add measurement without weakening thresholds.
The M4 benchmark task must report:

- lamp dirty queue peak/final backlog, lamp group updates, active gap count;
- evidence row count, support candidate visits, confirmed-rule count,
  dissemination dirty backlog;
- obligation due count, fulfillment count, violation count, rule compliance
  candidate visits;
- borrowed-shadow crisis transition count, active/recovered/terminal crisis
  counts and terminal reasons;
- director pressure sample count, candidate/rejection counts, cooldowns and
  recovery windows;
- ReasonTrace capacity use, dawn review retained rows, save bytes,
  load/rebuild time, Worker projection bytes, checkpoint hashes and M0-M3
  regression results.

Invariant failures must cover M0-M3 regression, lamp dirty backlog growth,
visual-authority mutation, evidence drift, invalid confirmed-rule support,
obligation leaks, compliance without knowledge, invalid crisis transitions,
director recovery-window violation, save/replay divergence, Worker projection
staleness, UI authority and M5 task/content creation.

## Migration Policy

- WM-0061 creates planning artifacts only. Rollback before implementation is
  reverting the M4 planning files, ADR-0009, task packets and narrow state
  markers.
- Downstream tasks add owner stores incrementally and must rebuild derived
  indexes from owner facts.
- Focused M4 save/replay may snapshot owner-store facts and deterministic
  streams only for `m4.core_vertical_slice.borrowed_shadow_lamps.v1`.
- Public save compatibility, public Worker protocol, schema migration, codec,
  package-boundary changes, dependencies and platform save UI are blocked until
  a separate reviewed gate approves them.
- If M4 closeout cannot pass, the project remains in M4 and no M5 task is
  promoted.

## Spark Classification

WM-0061 and the first-wave M4 downstream tasks are not Spark-eligible. They
define or touch architecture, deterministic simulation ownership, save/replay,
Worker parity, benchmark baselines or milestone closeout. The task report will
record that Spark was not used.

## Checks

Final check output is recorded in `coordination/reports/WM-0061.md`.
