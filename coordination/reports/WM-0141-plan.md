# WM-0141 - Post-M8 UI remediation release-readiness verdict update

## Goal

Update the post-M8 release-readiness record after the reviewed UI/playability remediation tasks, preserving the existing Web `demo-only` and Windows unsigned controlled-test verdicts and keeping all public-release actions owner-gated.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `D:/WebProjects/WumingTown/docs/wuming-post-m8-ui-remediation-goal-prompt.md`
- `coordination/tasks/WM-0141.json`
- `coordination/reports/WM-0127.md`
- `coordination/reports/WM-0127-future-owner-release-handoff.md`
- `coordination/reports/WM-0129-owner-blocker-record.md`
- `coordination/reports/WM-0129-remediation-dag.md`
- `coordination/reports/WM-0130.md`
- `coordination/reports/WM-0131.md` through `coordination/reports/WM-0140.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `coordination/project-state.json`

## Non-Goals

- No public release, release-candidate distribution, Early Access launch, store submission, signing, telemetry, accounts, paid services, public feedback or public save compatibility.
- No Web verdict change away from `demo-only`.
- No Windows verdict change beyond unsigned controlled external test.
- No product code, simulation, protocol, save, benchmark or platform changes.
- No new public-release or owner-gated execution task.

## Approach

1. Reconcile the original owner blocker list with WM-0130 audit findings and WM-0131 through WM-0140 verified evidence.
2. Add a post-M8 remediation verdict addendum to the M8 readiness matrix.
3. Add a short roadmap status note so future planning sees the post-M8 verdict without reinterpreting M8 as public release approval.
4. Update `coordination/project-state.json` to show WM-0141 verdict work is in progress and public gates remain closed.
5. Write the WM-0141 report with blocker-by-blocker status, remaining art production needs, and release-candidate audit eligibility.
6. Run required checks and request independent reviewer verification.

## Verdict Draft

- UI readiness: ready for release-candidate audit and controlled/demo review after remediation; not final public art or public release approval.
- Playability readiness: minimum playable chain ready as reviewed shell-local evidence; broader authoritative gameplay command protocol remains future owner-reviewed work.
- I18n readiness: current audited player shell ready for `zh-CN` and `en`; future content/read-model fields need continued structured localization.
- Responsive readiness: required windowed/fullscreen matrix ready with screenshot evidence.
- RC audit: may proceed only as an audit/gap-assessment lane after WM-0142 closeout, not as distribution or public release.

## Checks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`
