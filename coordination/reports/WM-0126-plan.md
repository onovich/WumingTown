# WM-0126 Plan

## Scope

- Consolidate M8 readiness evidence for Product UI, Responsive Layout,
  Localization, Visual Identity, First Playability, Accessibility, content,
  data-mod workflow, long-save, performance, and M0-M7 regression protection.
- Preserve existing platform verdicts:
  - Web: `demo-only`
  - Windows: `ready-for-controlled-external-test`
- Separate 1.0 readiness evidence from owner-gated public release, store,
  signing, telemetry, account, hosted-service, paid-service, and public save
  compatibility actions.
- Stay within allowed paths:
  - `docs/07_roadmap/**`
  - `docs/06_engineering/**`
  - `coordination/reports/WM-0126*.md`
  - `coordination/tasks/WM-0126.json`

## Required inputs

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0126.json`
- `coordination/reports/WM-0111-m8-scope-amendment.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/06_engineering/05_testing_policy.md`
- `coordination/reports/WM-0112.md` through `coordination/reports/WM-0125.md`

## Planned outputs

- `coordination/reports/WM-0126.md`
- If needed, limited evidence-matrix updates under allowed roadmap or
  engineering docs only

## Matrix structure

1. Productized shell UI and visual identity
2. Responsive layout evidence across required viewport matrix
3. Localization defaults, override persistence, completeness, and inventory
4. First-play surface and onboarding guidance
5. Accessibility and display-scale evidence
6. Content/endgame scope, anomaly/faction evidence, and data-mod policy
7. Long-save / migration evidence
8. Performance and regression evidence
9. Preserved verdicts and explicit owner-gated exclusions

## Execution steps

1. Consolidate acceptance evidence from WM-0112 through WM-0125 into a single
   readiness matrix keyed by gate area, evidence source, verdict, and residual
   owner gate.
2. Run all WM-0126 required checks with `corepack pnpm` where applicable and
   capture pass/fail, duration, artifacts, hashes, and notable warnings.
3. Compare current results against preserved M0-M7 baselines and confirm no
   threshold weakening or verdict drift.
4. Write the final task report, then complete the workflow handoff with
   `taskctl complete`.

## Required checks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`
- `corepack pnpm ci:local`
- `corepack pnpm test --filter m5-invariants`
- `corepack pnpm bench`
- `corepack pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
