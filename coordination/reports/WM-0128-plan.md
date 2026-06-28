# WM-0128 - Repair or explain M8 benchmark regressions blocking closeout

## Goal

Produce reviewed evidence that either repairs the repeated M8 benchmark
blocking regressions or explains them as reproducible measurement-only variance
without weakening the benchmark policy.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0128.json`
- `coordination/reports/WM-0126.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/06_engineering/05_testing_policy.md`
- Benchmark runner, baseline and affected benchmark sources under
  `packages/benchmarks/`

## Non-Goals

- Do not weaken benchmark baselines, thresholds or protected M0-M7 facts.
- Do not change Web `demo-only`, Windows controlled external-test, release,
  store, signing, telemetry, account, paid-service or public save decisions.
- Do not perform M8 closeout in this task; closeout can only proceed after
  this stop sign is independently reviewed.
- Do not change player UI, localization or screenshot evidence in this
  benchmark repair task.

## Current Facts And Assumptions

- WM-0126 was verified as a readiness matrix and stop-sign evidence artifact.
- WM-0126 recorded two `corepack pnpm bench` failures. The confirmation rerun
  still exceeded the 20 percent blocking threshold in `entity-store`,
  `m4-core-vertical-slice-long-run`, `map-dirty` and `spatial-index`.
- The benchmark policy remains 10 percent warning and 20 percent blocking
  regression.
- The first diagnostic pass will assume no product regression until fresh
  reruns and artifact comparisons identify whether the failure is reproducible
  on the current branch.

## Approach

1. Inspect the benchmark CLI, baseline loader and affected benchmark sources.
2. Read WM-0126 benchmark artifacts if they still exist under the recorded temp
   artifact roots.
3. Rerun `corepack pnpm bench` with isolated WM-0128 artifact roots, preserving
   the unchanged policy.
4. If failures reproduce, isolate whether they come from benchmark harness
   timing, test data size, recent product behavior or environment drift.
5. Repair only real product or harness defects inside the task's allowed paths,
   or document a reproducible measurement-only explanation with enough evidence
   for reviewer verification.
6. Rerun all required WM-0128 checks, write the task report and request
   independent review.

## Risks

- Performance measurements on shared Windows machines can be noisy. The report
  must not treat a single lucky pass as proof unless reruns and artifacts make
  the conclusion reviewer-verifiable.
- Editing benchmark code can accidentally weaken the guard. Any change must
  preserve the baseline file and 10/20 policy.
- Product fixes in hot paths can affect determinism, save/replay or protected
  M0-M7 facts; required scenario and quality gates must be rerun.

## Implementation Steps

1. Create this plan before product edits.
2. Inspect benchmark sources and WM-0126 artifacts.
3. Run fresh benchmark evidence under `WM_ARTIFACT_DIR`.
4. Patch only if diagnosis shows a real defect.
5. Record evidence and final verdict in `coordination/reports/WM-0128.md`.
6. Complete the task through `taskctl complete` and route to reviewer.

## Tests And Benchmarks

- `corepack pnpm typecheck`
- `corepack pnpm test --filter m5-invariants`
- `corepack pnpm bench`
- `corepack pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

## Rollback

If a repair is attempted and causes worse benchmark or regression behavior,
revert only the WM-0128-owned edits while keeping the plan/report evidence. Do
not change baselines or thresholds to force a pass.

## Completion Conditions

- Each WM-0128 acceptance criterion is mapped to benchmark artifacts, code
  inspection, tests or an explicit reviewed residual risk.
- The final report states whether the M8 benchmark stop sign is cleared or
  still blocks WM-0127 closeout.
- An independent reviewer verifies the evidence before integration.
