# WM-0096 - Product Gate Decision Report Plan

## Goal

Record the M6 Web and Windows product-gate verdict from reviewed WM-0087 through WM-0095 evidence without overclaiming readiness or starting M7.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0096.json`
- `coordination/artifacts/WM-0095/m6-product-gate-consolidation.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0094.md`
- `coordination/reports/WM-0095.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/08_codex/05_human_approval_gates.md`
- `coordination/project-state.json`

## Non-Goals

- No product implementation, bug fix, benchmark threshold edit or baseline edit.
- No release upload, installer, signing, store material, telemetry or paid service.
- No cancellation of Web as a future formal target.
- No M7 task claim, implementation or store/privacy/marketing work.

## Current Facts And Assumptions

- WM-0095 consolidated M6 evidence and was independently verified after a changes-requested fix.
- Web same-spec is not proven because current browser evidence is a product-gate shell plus Worker projection path, not a measured 30 TPS / 20k-entity browser authority runtime.
- Lower fast-forward and lower-cap Web tiers are also not proven by current evidence, because they would require a measured product-scale browser authority path.
- Windows can launch an unsigned local external-test directory build with sandboxed Electron boundaries.
- Windows/Web save-container interoperability and Windows host-side diagnostic package writing remain explicit blockers.

## Approach

- Write `coordination/reports/WM-0096.md` with explicit verdicts, evidence citations, blockers, residual risks, owner gates and M7 readiness input.
- Update the Web release gate and platform matrix with the WM-0096 verdict.
- Update `coordination/project-state.json` to reflect the decision state and remaining M6 closeout step.
- Keep the verdict within Roadmap-authorized M6 options: Web demo-only for current M6, not cancellation.

## Risks

- Overclaiming Web same-spec or lower-cap readiness from shell-only evidence.
- Treating unsigned Windows directory as public release readiness.
- Accidentally waiving M0-M5 regression gates or product-gate blockers.
- Recording a cancellation decision that would require owner approval.

## Implementation Steps

1. Draft the product-gate decision report.
2. Update roadmap/platform/project-state status markers.
3. Run required validation commands.
4. Send for independent reviewer verification.

## Tests And Baselines

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert WM-0096 report, roadmap/platform/project-state markers and task JSON. M6 remains open until a verified product-gate decision is restored.

## Done Conditions

- Web verdict is one of the approved M6 options and follows evidence.
- Windows external-test verdict is explicit and bounded.
- Known blockers and residual risks are enumerated.
- WM-0087 through WM-0095 evidence is cited.
- M0-M5 regressions and benchmark thresholds are not waived.
