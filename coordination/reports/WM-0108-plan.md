# WM-0108 Execution Plan

## Task

WM-0108 - Playtest checklist and tester protocol.

## Scope

- Produce a tester protocol and checklist for Windows controlled external test
  and Web demo-only evaluation.
- Include tutorial, balance, privacy/diagnostics, cultural-risk, save-policy,
  known-issues and feedback checks.
- Distinguish controlled testing from public release or Early Access launch.
- Add automated checklist validation for required gate language.

## Inputs

Required task inputs read:

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0108.json`
- `coordination/reports/WM-0097-future-m7-entry-prompt.md`
- `coordination/reports/WM-0098-m7-task-dag.md`
- `coordination/reports/WM-0101.md`
- `coordination/reports/WM-0102.md`
- `coordination/reports/WM-0103.md`
- `coordination/reports/WM-0104.md`
- `coordination/reports/WM-0105.md`
- `coordination/reports/WM-0106.md`
- `coordination/reports/WM-0107.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/06_engineering/03_definition_of_done.md`

Additional implementation inputs:

- `docs/03_world/08_m7_cultural_review_package.md`
- `docs/04_content_balance/09_m7_public_facing_terminology.md`
- `docs/05_tech/10_m7_privacy_feedback_diagnostics.md`
- `docs/05_tech/11_m7_save_compatibility_policy.md`
- `docs/07_roadmap/05_m7_web_demo_scope.md`
- `docs/07_roadmap/06_m7_store_playtest_material_draft.md`
- `docs/07_roadmap/07_m7_known_issues_release_notes.md`

## Implementation Steps

1. Create the protocol/checklist document under `docs/07_roadmap/`.
2. Add automated checklist validation under `tools/`.
3. Wire validation into `pnpm quality`.
4. Run required checks including `pnpm ci:local`.
5. Complete to independent reviewer.

## Non-Goals

- No public recruitment, public release, public Web launch, store submission,
  signing, installer or updater.
- No telemetry, accounts, paid services, crash upload or public feedback
  service.
- No final privacy/legal/store or public save compatibility claim.
- No runtime behavior changes unless separately approved.
- No M8 task creation, promotion, implementation or review.
