# WM-0107 Execution Plan

## Task

WM-0107 - Known issues and release notes draft.

## Scope

- Draft M7 known issues and external-test release notes from verified M6/M7
  evidence.
- Preserve exact blocker language from WM-0097, WM-0099, WM-0100, WM-0102,
  WM-0103, WM-0104 and WM-0105.
- Produce downstream-citable material for WM-0108 tester protocol and WM-0109
  readiness review.

## Inputs

Required task inputs read:

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0107.json`
- `coordination/reports/WM-0097.md`
- `coordination/reports/WM-0097-future-m7-entry-prompt.md`
- `coordination/reports/WM-0098-m7-task-dag.md`
- `coordination/reports/WM-0099.md`
- `coordination/reports/WM-0100.md`
- `coordination/reports/WM-0102.md`
- `coordination/reports/WM-0103.md`
- `coordination/reports/WM-0104.md`
- `coordination/reports/WM-0105.md`
- `docs/05_tech/10_m7_privacy_feedback_diagnostics.md`
- `docs/05_tech/11_m7_save_compatibility_policy.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/08_codex/05_human_approval_gates.md`

Additional downstream source read:

- `docs/07_roadmap/06_m7_store_playtest_material_draft.md`

## Implementation Steps

1. Create a citable known-issues and release-notes draft under
   `docs/07_roadmap/`.
2. Include Web/Windows blockers, diagnostics limitations, save policy risks,
   manual support boundaries and explicit non-goals.
3. Mark the release notes as controlled external-test draft only.
4. Write WM-0107 report and run required checks.
5. Complete to independent reviewer.

## Non-Goals

- No runtime implementation or test behavior changes.
- No benchmark baseline update.
- No public release upload, store submission, signing, installer or updater.
- No telemetry, accounts, paid services, crash upload or public feedback
  system.
- No final privacy/legal/store or public save compatibility claim.
- No M8 task creation, promotion, implementation or review.
