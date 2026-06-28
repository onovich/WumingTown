# WM-0129 - Owner UI Playability Blocker Audit And Remediation Planning

## Goal

Record the owner-reported post-M8 UI/playability blockers as release-readiness
stop signs, consult the art thread, audit the current UI/interaction/i18n
surface, and create a reviewed remediation DAG without entering any public
release lane.

## Read Context

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `coordination/roles.json`
- `coordination/project-state.json`
- `coordination/thread-registry.json`
- `coordination/reports/WM-0127.md`
- `coordination/reports/WM-0128.md`
- `coordination/reports/WM-0127-future-owner-release-handoff.md`
- `docs/01_design/09_m8_product_ui_design_system.md`
- `docs/01_design/10_m8_first_play_guidance.md`
- `docs/05_tech/12_m8_i18n_locale_contract.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`
- `docs/06_engineering/*`
- `docs/08_codex/*`
- Accepted ADRs, especially ADR-0011.

## Non-Goals

- No public release, EA launch, store submission, signing, telemetry, accounts,
  paid services, hosted feedback or public save compatibility.
- No change to Web `demo-only` or Windows unsigned
  `ready-for-controlled-external-test` verdicts.
- No product UI implementation in WM-0129 itself beyond reports and task
  packets.
- No final art asset licensing, cut-in purchase or high-cost art production.

## Current Facts

- `main` and `origin/main` are synchronized at
  `611d2a135c2ff516e1199a25e23219929b5f0b3b`.
- `WumingTown-main` has unrelated untracked launcher scripts; this task works
  in the clean `D:/WebProjects/WumingTown-WM-0129` worktree.
- Baseline control-plane gates passed before task creation:
  `validate-handoff`, `taskctl validate`, `taskctl status`, `git diff --check`
  and `corepack pnpm quality`.
- Bare `pnpm quality` failed in the main worktree because PATH resolves pnpm
  `11.7.0`; the repository-required invocation is `corepack pnpm` at `11.8.0`.
- Art consultation was sent to thread
  `019f0e16-f987-7f33-8b28-a348d92b2179` and is advisory only.

## Approach

1. Create `WM-0129` and downstream `WM-0130` through `WM-0142` task packets.
2. Record owner blocker evidence and the public-release owner gates.
3. Record art-thread consultation request and expected artifact.
4. Audit current UI/code state enough to scope downstream tasks.
5. Complete WM-0129, request independent review, then integrate only if
   verified.
6. After WM-0129 is done, let taskctl promote the first remediation tasks and
   dispatch implementation to the appropriate roles.

## Risks

- The existing UI has some M8 player-shell work, but owner screenshots show the
  perceived product surface still reads as a harness. The remediation must
  judge player perception and interaction, not just the existence of tests.
- The current protocol exposes only `Noop`/`Echo` player commands. If a real
  minimum playable command cannot be traced through the existing protocol, the
  implementation task must use a reviewed local adapter or spawn a protocol
  task instead of faking world authority.
- Responsive fixes can accidentally bury the map under panels. Required
  viewport evidence must include the owner's windowed/fullscreen problem
  sizes.
- Art thread output has arrived and is recorded in
  `coordination/reports/WM-0129-art-consultation.md`. Any later art refinement
  should update WM-0131 rather than changing WM-0129 scope.

## Tests And Gates

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

## Completion Conditions

- Owner blocker is recorded as release-readiness stop-sign evidence.
- Art consultation is completed or any later follow-up is routed to WM-0131.
- Current UI/interaction/i18n audit is recorded.
- Remediation DAG is present in task JSON and report form.
- Independent reviewer verifies WM-0129 before integration.
