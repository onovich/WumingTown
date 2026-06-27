# WM-0111 Execution Plan

## Goal

Incorporate `OWNER-AMENDMENT-2026-06-27-UI-I18N-PRODUCTIZATION` into the
reviewed M8 scope and create a reviewed M8 task DAG before any M8
implementation starts.

## Read Context

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `coordination/roles.json`
- `coordination/project-state.json`
- `coordination/thread-registry.json`
- `coordination/tasks/*.json`
- `coordination/reports/WM-0110.md`
- `coordination/reports/WM-0110-future-m8-entry-prompt.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/00_project/05_decision_register.md`
- `docs/05_tech/*`
- `docs/06_engineering/*`
- `docs/08_codex/*`
- `coordination/decisions/*.md`
- `PLANS.md`
- Owner screenshots:
  - `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-5044d35f-02ca-49ae-b072-33d52cd61964.png`
  - `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-334aa781-ccfc-4c2e-95a4-1c0fce1bd1c3.png`

## Current Facts

- `main` and `origin/main` are synchronized at
  `55578ac6bdeaf6dbbd5a90787b227331e96c187b`.
- `taskctl status` reports 110 tasks `done` and unread inbox `0` before
  WM-0111 creation.
- No `WM-0111` or later task existed before this task.
- `coordination/reports/WM-0110-future-m8-entry-prompt.md` exists and defines
  M8 as 1.0, but covers localization only at a high level.
- The Owner screenshots show a default UI that still reads as an M6
  diagnostics/product-gate harness, has mostly English player-facing text,
  exposes debug diagnostics by default, and has dense overlapping panels and
  awkward scroll regions in both windowed and fullscreen captures.

## Coverage Audit

Existing M8 prompt coverage is insufficient for:

- Product UI Gate.
- Responsive Layout Gate with explicit viewport matrix.
- Localization Gate with zh-CN/en defaults, manual override, missing-key
  tests and hardcoded player-string extraction.
- Visual Identity Gate.
- First Playability Gate.
- Accessibility Gate.

Therefore WM-0111 must amend M8 scope and create a reviewed task DAG before
implementation.

## Non-Goals

- No UI, app, package, tool or runtime implementation in WM-0111.
- No public release, 1.0 release, Early Access launch, store submission,
  public Web launch, signing, installer/updater, telemetry, accounts, hosted
  feedback, crash upload, paid services, final legal/privacy/store copy or
  public save compatibility commitment.
- No Web verdict change and no Windows verdict change.
- No post-M8 task creation, claim or implementation.

## Implementation Steps

1. Write `coordination/reports/WM-0111-m8-scope-amendment.md`.
2. Amend `coordination/reports/WM-0110-future-m8-entry-prompt.md` with the
   Owner UI/i18n/responsive gates.
3. Write `coordination/reports/WM-0111-m8-task-dag.md`.
4. Create proposed M8 task packets `WM-0112` through `WM-0127`.
5. Update roadmap, quality gates and project state with M8 amendment markers.
6. Run all WM-0111 required checks.
7. Complete to independent reviewer; integrate and mark done only after
   `verified`.

## Required Checks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `pnpm quality`
- `pnpm ci:local`
- `pnpm test --filter m5-invariants`
- `pnpm bench`
- `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`

## Rollback

Revert WM-0111 reports, M8 prompt amendment, downstream M8 task packets,
roadmap/project-state markers and WM-0111 task state. Leave WM-0110 verified
closeout intact and M8 implementation unstarted.
