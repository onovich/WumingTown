# WM-0087 - Chrome and Edge performance memory and loading gate

## Goal

Produce reproducible Chrome Stable and Edge Stable evidence for the current Web
product-gate harness, then state explicitly which M6 Web gate targets are met,
which are only partially evidenced, and which remain blocked.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0087.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0086.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `apps/web/src/product-gate-harness.data.json`
- `apps/web/src/product-gate-fixture.ts`
- `apps/web/src/shell-bootstrap.ts`
- `apps/web/src/web-shell.e2e.test.ts`
- `packages/sim-worker/src/index.ts`
- `packages/sim-core/src/m5-worker-projection.ts`
- Existing `pnpm bench` and `pnpm test:e2e --filter web-shell` gates.

## Non-Goals

- No simulation-authority change.
- No product behavior repair or renderer optimization disguised as a benchmark
  task.
- No M5 benchmark artifact rewrite.
- No threshold weakening in `packages/benchmarks/baseline.json` or benchmark
  comparison logic.
- No owner-level Web cancellation decision inside WM-0087.

## Current Facts And Assumptions

- WM-0086 provides a deterministic Web shell fixture and build report, but the
  default shell is a read-only fixture consumer, not a proven 20k-entity
  product-scale runtime.
- The browser Worker smoke path proves protocol/parity checkpoints, but the M5
  browser Worker path is projection/checkpoint oriented rather than a measured
  continuous 30 TPS product runtime.
- Because of those two constraints, WM-0087 may be able to prove loading,
  bundle, browser-shell interaction, and memory stability for the current shell
  while still failing or blocking the full 30 TPS same-spec gate.

## Approach

- Add a narrow measurement script under `tools/` that:
  - serves the built Web artifact;
  - launches Chrome Stable and Edge Stable directly;
  - records navigation/load timings, bundle-report evidence, shell interaction
    latency percentiles, animation-frame pacing, long-task samples, and memory
    samples;
  - writes a machine-readable JSON artifact outside the repo by default so the
    task does not rewrite tracked artifacts.
- Reuse the existing WM-0086 shell/debug payload and build report instead of
  changing product behavior.
- Compare measured evidence against the M6 Web gate targets and report blockers
  explicitly when the current Web harness cannot prove product-scale 30 TPS
  behavior.

## Risks

- Local machine/browser variance can move timing numbers.
- Browser memory APIs may expose only JS heap or partial process memory.
- The current shell may look healthy while still being insufficient for the
  true M6 same-spec verdict, so the report must separate "current shell pass"
  from "product-gate pass."

## Implementation Steps

1. Add the reproducible Chrome/Edge measurement script and keep its outputs in
   temp or caller-specified artifact paths.
2. Run the build/harness required to produce the WM-0086 release-gate report.
3. Run the new measurement script in both browsers and capture raw evidence.
4. Run required task checks without weakening existing benchmark thresholds.
5. Write `coordination/reports/WM-0087.md` with explicit pass/blocker mapping
   to the task acceptance criteria.
6. Complete through `taskctl` and hand off to reviewer.

## Tests And Evidence

- `pnpm build:web`
- `pnpm bench`
- `pnpm test:e2e --filter web-shell`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`
- Chrome Stable and Edge Stable measurement output from the new script

## Rollback

- Revert the WM-0087 measurement script and doc/report notes.
- Keep any failed browser evidence only in the task report; do not rewrite M5
  benchmark artifacts.

## Done Conditions

- Chrome and Edge evidence is recorded for loading, main-thread shell work,
  memory sampling, and compressed download size.
- The report states clearly whether current evidence supports same-spec, lower
  cap, lower fast-forward, demo-only, or only a blocker/cancellation candidate.
- Any missing product-scale 30 TPS proof is documented as a blocker rather than
  hidden behind shell-only numbers.
- Required checks run and the benchmark threshold policy remains unchanged.
