# WM-0045 Owner Plan And Architecture Self-Check

## Source Documents Read

- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `AGENTS.md`
- `CODEX_START_HERE.md`
- `coordination/tasks/WM-0045.json`
- `coordination/reports/WM-0044-future-m3-entry-prompt.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/07_m2_work_logistics_vertical_slice_plan.md`
- `docs/02_systems/01_time_scheduler_rng.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/02_systems/05_needs_health_mood_social.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/02_systems/14_explainability_debug_observability.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `docs/08_codex/08_spark_execution_lane.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `.agents/skills/wuming-town-agent-workflow/assets/report-template.md`

## Planning Decisions

- M3 starts with `WM-0046` scenario contract and `WM-0047` architecture ADR gate.
  Runtime implementation tasks depend on the architecture gate.
- The implementation DAG is split by state ownership surfaces: needs,
  day/night/weather, rest, food, health/abilities, medical care,
  mood/thoughts, relationships, integrated scenario, save/replay, Worker
  parity, benchmarks, and closeout.
- No downstream task is ready at creation time. Every proposed task depends on
  an unfinished predecessor, starting with `WM-0046` depending on `WM-0045`.
- `coordination/project-state.json` is updated narrowly to say M3 planning is
  active and implementation is unstarted.
- Changes-requested repair: `WM-0060` now explicitly owns a future M4 entry
  prompt handoff artifact at
  `coordination/reports/WM-0060-future-m4-entry-prompt.md`. WM-0045 does not
  create that artifact; it is a required WM-0060 closeout deliverable and must
  remain non-executable in WM-0060.

## Architecture Boundaries Preserved

- Authority stays in Simulation Worker or Node headless.
- UI, Pixi, React, and Electron remain read-only consumers.
- `sim-core` purity, fixed 30 TPS, seeded RNG, stable ordering, integer or
  fixed-point semantics, bounded indexed thinking, serializable jobs,
  structured reasons, save/replay, Worker parity, and independent review are
  explicit gates in the plan and JSON packets.
- M4 lamp, Chronicle, anomaly, crisis-chain, and director product work are
  excluded.

## Acyclic DAG Check

The proposed dependency order is:

`WM-0045 -> WM-0046 -> WM-0047 -> {WM-0048, WM-0049, WM-0052} -> {WM-0050, WM-0051, WM-0053, WM-0054} -> WM-0055 -> WM-0056 -> WM-0057 -> WM-0058 -> WM-0059 -> WM-0060`.

Additional dependencies are only from lower IDs to higher IDs:

- `WM-0050` depends on `WM-0048` and `WM-0049`.
- `WM-0051` depends on `WM-0048` and `WM-0049`.
- `WM-0053` depends on `WM-0052`.
- `WM-0054` depends on `WM-0048`, `WM-0049`, and `WM-0052`.
- `WM-0056` depends on `WM-0050`, `WM-0051`, `WM-0053`, and `WM-0055`.

No edge points backward, so the graph is acyclic.

`WM-0060` is still the terminal M3 closeout node. Its added future M4 entry
prompt is a handoff artifact, not a new M4 task node, so the M3 task DAG remains
acyclic and M4 remains unstarted.

## Block Conditions For Downstream Owners

Downstream owners must block before implementation if they need:

- a mutable fact without a named owner store;
- a normal-tick global scan;
- an unversioned cache or derived index as authority;
- public Worker protocol, save format, schema, dependency, or package-boundary
  changes;
- UI-owned simulation state;
- M4 lamp, Chronicle, anomaly, crisis-chain, or director product scope.
- missing future handoff discipline after M3 closeout; WM-0060 must produce the
  future M4 entry prompt while forbidding M4 task creation, promotion, claim, or
  implementation.

## Reviewer Repair

Reviewer finding on 2026-06-25: the M3 DAG stopped at WM-0060 and blocked M4,
but did not define an explicit future M4 entry prompt or handoff gate.

Repair: updated the M3 plan and `coordination/tasks/WM-0060.json` so M3
closeout must write `coordination/reports/WM-0060-future-m4-entry-prompt.md` as
a future, non-executable M4 handoff prompt. The repair does not create the
artifact now and does not create, promote, claim, or implement M4 work.

## Spark Classification

WM-0045 and all first-wave M3 downstream tasks are not Spark-eligible. They
define or touch architecture, deterministic simulation, job/reservation
ownership, save/replay, Worker parity, benchmark baselines, or milestone
closeout.

## Checks

Checks are recorded in `coordination/reports/WM-0045.md`.
