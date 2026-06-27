# WM-0098 - Create M7 Planning Package And Task DAG

## Goal

Create the reviewed M7 Early Access / public playtest preparation planning
package from the verified WM-0097 future M7 prompt without starting M7
implementation.

## Read Context

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `coordination/roles.json`
- `coordination/project-state.json`
- `coordination/thread-registry.json`
- `coordination/tasks/*.json`
- `coordination/reports/WM-0097.md`
- `coordination/reports/WM-0097-future-m7-entry-prompt.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `docs/05_tech/*`
- `docs/06_engineering/*`
- `docs/08_codex/*`
- Existing ADRs and `PLANS.md`

## Non-Goals

- No M7 product implementation inside WM-0098.
- No M8 task creation, promotion, claim, implementation or review.
- No public release, Early Access release, store submission, signing,
  telemetry, account system, paid service, crash upload or final public save
  compatibility commitment.
- No change to M6 Web `demo-only` verdict or Windows unsigned controlled
  external-test verdict.

## Current Facts

- `main` and `origin/main` are synchronized at
  `701faf9e0260253ebf191cb8f2ce155120ffa378`.
- Task control plane had 97 done tasks before WM-0098 was created.
- No WM-0098+ task JSON existed before this task.
- WM-0097 is done, verified, integrated and pushed.
- The M7 entry prompt exists at
  `coordination/reports/WM-0097-future-m7-entry-prompt.md`.
- Startup gates passed before M7 planning edits:
  `validate-handoff`, `taskctl validate/status`, `git diff --check`,
  `pnpm quality`, `pnpm ci:local`, `pnpm test --filter m5-invariants`,
  isolated `pnpm bench`, and the M5 100000-tick headless run.

## Approach

1. Create `coordination/reports/WM-0098-m7-task-dag.md` as the reviewed M7 DAG
   source.
2. Instantiate concrete M7 task packets as `proposed` tasks.
3. Keep downstream M7 tasks unclaimed until WM-0098 is independently reviewed,
   integrated and done.
4. Record narrow Roadmap/project-state planning markers.
5. Run all WM-0098 required gates, complete to reviewer, and integrate only
   after independent verification.

## Risks

- M7 planning could become accidental public release planning. Mitigation:
  every task carries owner gates and forbidden paths for release/signing/store
  work.
- M7 could under-cover privacy, cultural review, save compatibility or known
  issues. Mitigation: split these into explicit task packets.
- Web/Windows verdicts could be overclaimed. Mitigation: Web demo-only and
  Windows controlled-external-test statements are separate tasks and remain
  dependencies for public-facing material drafts.

## Tests And Gates

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `pnpm quality`
- `pnpm ci:local`
- `pnpm test --filter m5-invariants`
- `pnpm bench`
- `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`

`pnpm ci:local` and `pnpm bench` should use temporary artifact roots during
planning validation to avoid rewriting reviewed historical artifacts.

## Done

- Startup audit is recorded.
- M7 DAG is written.
- M7 task packets are created and remain proposed.
- No implementation or owner-gated release action starts.
- Required gates pass.
- Independent reviewer verifies WM-0098 before integration.
