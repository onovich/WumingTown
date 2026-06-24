# WM-0032 - Produce the M2 Work/Logistics Vertical Slice Plan

## Objective

Produce a reviewed M2 planning/control package: an acyclic task DAG and task packets for the work/logistics vertical slice, without starting implementation or M3.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0032.json`
- `coordination/reports/WM-0030-m2-entry-prompt.md`
- `coordination/reports/root-handoff-m1-to-m2.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/02_systems/06_economy_logistics_production.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/02_systems/14_explainability_debug_observability.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `docs/08_codex/01_model_assignment.md`
- `docs/08_codex/08_spark_execution_lane.md`
- `PLANS.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `docs/07_roadmap/06_m1_simulation_kernel_plan.md`
- `coordination/reports/WM-0012.md`

## Non-Goals

- No product/runtime/test implementation changes.
- No package manifest, lockfile, Worker protocol, save format, schema, or dependency changes.
- No broad economy, town-life, anomaly, combat, platform save UI, content expansion, or balance production work.
- No M3 tasks or implementation branch claims.
- No Spark dispatch from WM-0032.

## Current Facts And Assumptions

- WM-0031 is done, and WM-0032 is the only ready task at claim time.
- The active branch is `task/WM-0032-produce-the-m2-work-logistics-vertical-slice-pla`.
- M1 already owns deterministic map, region, path, reservation, WorkOffer, job, hauling/building, save/replay, Worker parity, and benchmark foundations.
- M2 should compose and harden those foundations under a stricter vertical-slice target: 20 actors hauling/building and 100 path requests under versioned invalidation.
- The roadmap states an M2 gate of 10 actors; WM-0032 intentionally uses the stricter 20-actor requirement from the M2 entry prompt.

## Plan

1. Create `docs/07_roadmap/07_m2_work_logistics_vertical_slice_plan.md` with non-negotiable boundaries, DAG, owner gates, rollback, migration, testing, performance, and Spark classification.
2. Create proposed task packets `coordination/tasks/WM-0033.json` through `coordination/tasks/WM-0043.json`.
3. Each task packet lists objective, allowed paths, forbidden paths, dependencies, owner, reviewer, acceptance, required checks, benchmark impact, review routing, rollback model, owner gate, and Spark eligibility.
4. Keep all downstream implementation tasks in `proposed`; only dependency completion and project-director integration should promote them later.
5. Write the WM-0032 work report and run the exact required WM-0032 checks before completion.

## Risks

- Over-broad M2 task packets could invite feature creep. Mitigation: each packet states forbidden paths and excluded product areas.
- Hidden architecture drift could appear in work selection, reservations, save/replay, or Worker parity. Mitigation: WM-0034 is an explicit architecture gate before implementation.
- Benchmark tasks can become post-hoc evidence. Mitigation: every implementation packet states benchmark impact, and WM-0042 is a hard long-run gate.
- Spark may be tempting for small implementation slices. Mitigation: first-wave M2 tasks are marked not Spark-eligible because they touch architecture, deterministic simulation, save/replay, Worker parity, or performance baselines.

## Implementation Steps

1. Add the M2 roadmap plan.
2. Add proposed task JSONs.
3. Add the WM-0032 report.
4. Run required checks:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. Complete WM-0032 through `taskctl complete`.

## Tests And Benchmarks

WM-0032 has no runtime behavior. Validation is through repository handoff validation, coordination schema validation, status inspection, diff whitespace checks, and the existing full `pnpm quality` gate.

## Rollback

Revert only the WM-0032 planning/control files: the M2 roadmap plan, WM-0032 report files, and proposed WM-0033 through WM-0043 task packets. Reverting the claim/complete history would require taskctl repair and should not be done casually.

## Completion Conditions

- Acyclic M2 DAG exists and excludes M3.
- Every task packet has the required planning fields.
- Worker/headless authority, sim-core purity, indexed bounded selection, serializable jobs, structured reasons, save/replay, Worker parity, and benchmark gates are preserved.
- Scope remains inside the work/logistics vertical slice.
- No implementation branch is started.
- Required WM-0032 checks pass and completion is routed to `reviewer`.
