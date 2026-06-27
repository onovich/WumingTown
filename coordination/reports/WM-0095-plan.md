# WM-0095 - Long-Run Scenario And Benchmark Consolidation Plan

## Goal

Consolidate M6 headless, Worker, Web, Windows, benchmark, storage and diagnostic evidence into a reviewer-checkable product-gate artifact without changing thresholds or verified M5 artifacts.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0095.json`
- `coordination/reports/WM-0083.md`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0087.md`
- `coordination/reports/WM-0090.md`
- `coordination/reports/WM-0094.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `tools/web-performance-gate.mjs`
- Existing benchmark CLI and artifacts.

## Non-Goals

- No benchmark threshold weakening.
- No product fixes inside this QA task.
- No rewrite of verified WM-0083 M5 benchmark artifacts.
- No save schema, Worker protocol, Electron preload or runtime authority change.
- No M7 work.

## Current Facts And Assumptions

- M5 final world/read-model hashes must remain `0xfba70a5c` and `0x9ba83cb7`.
- The default benchmark CLI can be directed to a safe artifact root through `WM_ARTIFACT_DIR`.
- Web performance evidence lives in the WM-0087 harness and may be regenerated into a WM-0095 artifact path.
- Windows package evidence is generated under `dist/desktop/wm-desktop-package-report.json` by the existing desktop package build.
- Web save/export/import, diagnostics, input and Windows package launch are already covered by WM-0094 `pnpm test:e2e`.

## Approach

- Add a small consolidation script under `tools/` that reads:
  - the WM-0095 benchmark artifact,
  - the Web release-gate report,
  - the Web performance-gate report,
  - the Windows package report,
  - and the WM-0094 smoke report.
- The script will assert M5 hash protection, benchmark comparison status,
  release-gate target identity, browser target evidence, Windows security
  boundaries and explicit non-release boundaries.
- The script will write a machine-readable WM-0095 consolidation artifact and a SHA-256 sidecar under `coordination/artifacts/WM-0095/`.
- Documentation will record that WM-0095 uses a WM-0095 artifact root to avoid rewriting the reviewed WM-0083 benchmark evidence.

## Risks

- A default `pnpm bench` run could dirty WM-0083 artifacts. Use `WM_ARTIFACT_DIR=coordination/artifacts/WM-0095` for this task's benchmark evidence.
- Chrome/Edge memory APIs may remain partial; record availability and JS heap samples without over-claiming total memory.
- Benchmark warnings must be reported and explained; failures or hash drift block the task.
- The consolidation artifact must not be treated as a product verdict or M7 entry.

## Implementation Steps

1. Add `coordination/artifacts/WM-0095/**` to WM-0095 allowed paths.
2. Add `tools/m6-product-gate-consolidation.mjs`.
3. Run Web build/performance, e2e smoke, M5 invariants, benchmark, M5 headless long-run and the consolidation script.
4. Update testing/performance/roadmap docs with WM-0095 consolidation evidence.
5. Write WM-0095 report and send for independent review.

## Tests And Baselines

- `pnpm build:web`
- `node tools/web-performance-gate.mjs --output coordination/artifacts/WM-0095/web-performance-gate.json`
- `pnpm test:e2e`
- `pnpm test --filter m5-invariants`
- `WM_ARTIFACT_DIR=coordination/artifacts/WM-0095 pnpm bench`
- `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
- `node tools/m6-product-gate-consolidation.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the consolidation tool, WM-0095 artifact, docs, report and task JSON changes. Leave M6 product-gate verdict blocked until valid evidence is regenerated.

## Done Conditions

- M5 hashes remain protected or the task blocks for reviewed migration evidence.
- Benchmark comparisons do not fail and thresholds remain unchanged.
- Web build/loading/memory, save/import/export, diagnostics and Windows package evidence are recorded.
- No M7 work, public release, signing, upload or telemetry is introduced.
- Required checks pass and an independent reviewer verifies the task.
