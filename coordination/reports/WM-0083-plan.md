# WM-0083 - M5 Benchmarks, Invariants and M6 Stop Signs

## Goal

Add reviewed M5 long-run invariant and benchmark evidence for
`m5.alpha_content_framework.first_season.v1` while keeping M6 as stop signs
only.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0083.json`
- `coordination/reports/WM-0071-future-m5-entry-prompt.md`
- `coordination/decisions/ADR-0010.md`
- `docs/02_systems/19_m5_alpha_content_framework_scenario.md`
- `docs/07_roadmap/10_m5_alpha_content_framework_plan.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- Existing M4 long-run invariant and benchmark gates.

## Non-Goals

- No M6 task creation, promotion, claim, implementation or review.
- No product behavior fixes inside this benchmark task.
- No UI, Worker protocol redesign, public save compatibility, schema
  expansion, dependency, package or platform packaging work.
- No threshold weakening or retry/repeat policy changes.

## Current Facts And Assumptions

- WM-0082 is done and pushed; M5 Worker parity evidence exists for the
  reviewed checkpoint stream.
- The M5 scenario alias is `m5-alpha-content-framework`, requested seed is
  `5`, authoritative seed is `155`, and content manifest hash is
  `0xe55d3015`.
- Existing benchmark CLI artifacts already include runtime environment, git
  commit, canonical payload SHA-256 and sidecar file SHA-256.
- The benchmark baseline format uses per-benchmark 10 percent warning and 20
  percent blocking thresholds; WM-0083 must preserve those values.

## Approach

- Add a focused `m5-invariants` Vitest gate in `sim-core` using the M5
  scenario, replay/save helpers and Worker projection helpers.
- Add an M5 long-run benchmark module that records content-validation,
  anomaly, faction/governance, season-event, save/load, replay, Worker
  projection, M0-M4 regression and M6 stop-sign evidence.
- Register the benchmark in the existing benchmark suite, CLI parser, baseline
  parser and public exports without changing CLI contracts.
- Update `packages/benchmarks/baseline.json` with a reviewed M5 entry that
  keeps `warnRegressionPercent: 10` and `failRegressionPercent: 20`.
- Generate WM-0083 benchmark artifacts and record exact hashes in the work
  report.
- Update performance, observability and milestone docs with M5 closeout
  evidence and stop signs only.

## Risks

- Long-run evidence could become product repair work; any product failure will
  be blocked or split instead of patched in this task.
- Benchmark artifact hashes can be ambiguous; the report will name both the
  sidecar file SHA-256 and the canonical payload digest when present.
- Adding M5 to the default benchmark suite may expose runtime variance; only
  reviewed baseline values and existing 10/20 thresholds will be used.
- Stop-sign wording must not become M6 planning.

## Implementation Steps

1. Inspect M5 summary, save/replay, Worker projection and CLI baseline shapes.
2. Implement and register the M5 invariant gate.
3. Implement and register the M5 long-run benchmark and baseline parser.
4. Generate benchmark baseline/artifact evidence and update docs/report.
5. Run all required WM-0083 checks.
6. Complete taskctl, route to independent review, integrate only after
   verification, then close and push.

## Tests And Baseline

- `pnpm typecheck`
- `pnpm test --filter m5-invariants`
- `pnpm bench`
- `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert M5 invariant tests, benchmark module/registrations, baseline entry,
WM-0083 artifacts, docs and reports. Leave M5 open and do not advance M6.

## Completion Conditions

- Acceptance evidence covers content drift, anomaly leaks, faction/governance
  authority, event queue growth, save/replay divergence, Worker mismatch and
  M0-M4 regression.
- Benchmark artifact includes runtime environment, commit, seed, scenario,
  manifest hash, tick horizon, checkpoint hashes, final summary and reviewed
  SHA-256 evidence.
- Baseline thresholds remain 10 percent warning and 20 percent blocking.
- No M6 coordination task is created, promoted, claimed, implemented or
  reviewed.
