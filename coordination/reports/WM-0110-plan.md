# WM-0110 Execution Plan

Status: in progress. This plan scopes the M7 closeout candidate and the
non-executable future M8 handoff artifact. It does not start M8.

## Inputs Read

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0110.json`
- `coordination/reports/WM-0097.md`
- `coordination/reports/WM-0097-future-m7-entry-prompt.md`
- `coordination/reports/WM-0098-m7-task-dag.md`
- `coordination/reports/WM-0099.md` through `coordination/reports/WM-0109.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/08_codex/05_human_approval_gates.md`
- `docs/06_engineering/03_definition_of_done.md`

## Precondition Audit

WM-0098 through WM-0109 exist, are milestone `M7`, are `done`, have independent
review verdict `verified`, and have integration records. WM-0110 is the only
active M7 task.

M7 evidence confirms:

- WM-0099: first-run onboarding and player path.
- WM-0100: early-game balance/readability package.
- WM-0101: cultural review and terminology safety.
- WM-0102: privacy, feedback and diagnostics readiness.
- WM-0103: Windows unsigned controlled external test instructions.
- WM-0104: Web demo-only scope statement.
- WM-0105: save compatibility policy draft.
- WM-0106: store/public playtest material draft.
- WM-0107: known issues and release notes draft.
- WM-0108: playtest checklist and tester protocol.
- WM-0109: validation matrix and readiness decision.

## Closeout Work

1. Write `coordination/reports/WM-0110.md` with:
   - completed M7 capabilities;
   - validation matrix summary;
   - technical debt and blockers;
   - cultural review, privacy/feedback and save compatibility states;
   - owner gates;
   - M8 readiness verdict;
   - proof that M8 was not started.
2. Write `coordination/reports/WM-0110-future-m8-entry-prompt.md` as a
   non-executable future prompt. It must be usable only after a future
   owner-sent M8 goal and must require a reviewed M8 planning DAG before any
   M8 implementation.
3. Update roadmap closeout notes and project state without creating,
   promoting, claiming, implementing or reviewing any M8 task.
4. Run every WM-0110 required check.
5. Complete to an independent reviewer. Integrate and mark done only after a
   verified review.

## Non-Goals

- No M8 task creation, promotion, claim, implementation or review.
- No public release, Early Access launch, store submission, public Web launch,
  signing, installer, updater, telemetry, accounts, hosted feedback, crash
  upload, paid services or final public save compatibility promise.
- No app, package, runtime, save schema, benchmark baseline or protocol changes.

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
