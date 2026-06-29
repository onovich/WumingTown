# WM-0140 - Visual regression screenshot and interaction evidence gate

## Goal

Produce reviewer-inspectable Web visual artifacts for required responsive viewports in `en` and `zh-CN`, plus automated evidence that fails on major HUD clipping/overlap, missing key controls, selection regression, camera regression, or minimum playable command-chain regression.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0140.json`
- `coordination/reports/WM-0135.md`
- `coordination/reports/WM-0136.md`
- `coordination/reports/WM-0137.md`
- `coordination/reports/WM-0138.md`
- `docs/06_engineering/05_testing_policy.md`
- `apps/web/src/web-shell.e2e.test.ts`

## Non-Goals

- No product-direction, release-verdict, or platform-verdict changes.
- No threshold weakening or scope cuts to make E2E pass.
- No new authoritative gameplay, Worker protocol, save-schema, or localization-surface redesign.
- No edits outside `apps/web/src/**`, `tools/**`, `coordination/reports/WM-0140*.md`, and task metadata history.

## Current Facts And Assumptions

- WM-0135 already added a responsive viewport matrix with DOM-layout assertions, but its screenshot helper is disabled and its artifact path is task-specific to WM-0135.
- WM-0136, WM-0137, and WM-0138 already cover selection, camera, and a reviewed local playable adapter in `web-shell` E2E.
- The required `corepack pnpm test --filter web-shell` command is still an unsupported unit-runner shape; the effective focused Web E2E path is `node tools/test-runner.mjs e2e --filter web-shell`.
- Allowed paths do not include `coordination/artifacts/**`, so WM-0140 visual outputs should live under an allowed path, with report links to those files.

## Approach

- Add WM-0140-specific artifact roots and report-format helpers in `apps/web/src/web-shell.e2e.test.ts`.
- Enable screenshot capture for the responsive matrix into a committed reviewer path under `tools/**`, while keeping WM-0135 DOM evidence separate.
- Add a dedicated WM-0140 evidence test that records:
  - default player HUD screenshots in `en` and `zh-CN`
  - explicit diagnostics overlay screenshots distinct from the default HUD
  - selection, camera, and command-chain state evidence with machine-readable payload summaries
- Write a WM-0140 visual artifact Markdown file that links screenshots and records the relevant interaction/debug evidence.

## Risks

- The full `test:e2e` suite may be time-expensive; run it if feasible and record exact results rather than substituting a narrower gate.
- Screenshot count can grow quickly across locale/surface/viewport combinations; keep the set reviewer-usable but still acceptance-complete.
- Chinese text assertions must stay deterministic despite the Windows console encoding quirk; rely on the TypeScript source and browser assertions, not terminal rendering.

## Steps

1. Add WM-0140 plan and artifact/report paths.
2. Update responsive artifact helpers to emit WM-0140 screenshots and a dedicated visual Markdown artifact.
3. Add or extend E2E evidence for selection, camera, and command-chain screenshots plus structured summaries.
4. Run focused Web E2E first, then the required repository gates.
5. Write `coordination/reports/WM-0140.md` with artifact paths, exact check outcomes, and residual visual-production needs separated from functional blockers.
6. Send `taskctl complete` to reviewer without marking the task done.

## Tests And Checks

- `node tools/test-runner.mjs e2e --filter web-shell`
- `corepack pnpm test:e2e`
- `corepack pnpm test --filter web-shell` and record unsupported status if unchanged
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `corepack pnpm quality`

## Rollback

Revert WM-0140-specific E2E artifact helpers and report-generation changes if they introduce instability, while preserving prior WM-0135..WM-0138 behavior and assertions.

## Done Conditions

- Required responsive visual artifacts exist in `en` and `zh-CN`.
- Default player HUD and diagnostics overlay are visually distinguished in recorded evidence.
- Automated coverage fails on major clipping/overlap, missing key controls, selection failure, camera failure, or command-chain failure.
- Residual visual-production issues are recorded separately from blocker status.
- Required checks are run and reported without weakening existing gates.
