# WM-0142 - Post-M8 UI playability remediation closeout

## Goal

Close the post-M8 UI/playability remediation phase after every remediation task is independently reviewed, integrated, pushed to main, and validated by the required closeout gates.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0142.json`
- `coordination/reports/WM-0129*.md`
- `coordination/reports/WM-0130.md` through `coordination/reports/WM-0141.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `coordination/project-state.json`

## Non-Goals

- No public release, release-candidate distribution, Early Access launch, store submission, signing, telemetry, accounts, paid services, hosted feedback, public feedback or public save compatibility.
- No Web verdict change away from `demo-only`.
- No Windows verdict change beyond unsigned controlled external test.
- No product code, simulation, protocol, save schema, benchmark baseline or benchmark threshold changes.
- No creation or execution of future public-release tasks.

## Closeout Criteria

- WM-0129 through WM-0141 are `done`, independently reviewed as `verified` and integrated by `project-director`.
- Closeout report records UI readiness, playability readiness, i18n readiness, responsive readiness, remaining art needs and release-candidate audit eligibility.
- Required gates pass:
  - handoff validation
  - task validation/status
  - `git diff --check`
  - `corepack pnpm quality`
  - focused Web E2E for selection/camera/language/minimum-command evidence
  - `corepack pnpm ci:local`
  - `corepack pnpm test --filter m5-invariants`
  - `corepack pnpm bench`
  - 100000-tick M5 alpha scenario
- main and origin/main are synchronized after final integration/push.

## Planned Edits

- `coordination/reports/WM-0142.md`: closeout report with evidence and check results.
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`: mark post-M8 remediation closeout as closed after WM-0142.
- `docs/07_roadmap/01_milestones_and_quality_gates.md`: add final post-M8 closeout status.
- `coordination/project-state.json`: update phase to closed post-M8 remediation; public gates remain owner-gated.
- `coordination/tasks/WM-0142.json`: task workflow state only.

## Rollback

If any closeout gate fails, do not lower thresholds or close WM-0142. Record the blocker, repair within allowed scope if it is a documentation/control-plane issue, or create a separate reviewed repair task if product code or another task's ownership is required.
