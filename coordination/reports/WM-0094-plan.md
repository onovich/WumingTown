# WM-0094 - External Test Build Smoke Plan

## Goal

Prove the M6 Web and Windows external-test smoke path launches real product-gate artifacts instead of an empty shell or stale build output.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0094.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0093.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- Existing Web and Desktop Electron e2e smoke tests.

## Non-Goals

- No storefront material, public upload, signing credentials or telemetry.
- No M7 work and no product scope change.
- No new Electron preload bridge or host filesystem diagnostics API.
- No weakening of M0-M5 simulation, save, replay or benchmark baselines.

## Current Facts And Assumptions

- WM-0087 through WM-0093 are done and WM-0094 is ready.
- The Web production build target is `apps/desktop-electron/dist/renderer`.
- `tools/web-release-gate-report.mjs` records the `wm-0086-web-product-gate` harness, Chrome/Edge assumptions, bundle size evidence and SharedArrayBuffer fallback assumptions.
- `apps/desktop-electron/package-dir.ts` is expected to clean and recreate the unpacked Windows artifact path.
- Existing e2e tests already cover shell launch, M5 product-gate fixture visibility, save/export/import on Web, input, diagnostics and Electron sandbox checks.

## Approach

- Extend the packaged Desktop Electron e2e smoke to seed stale output in both the main bundle output and the unpacked Windows artifact directory before `pnpm build:desktop`.
- Assert the stale unpacked Windows marker is gone after packaging, proving the external-test artifact path starts clean.
- Assert the packaged e2e path has a generated Web release-gate report with the M5 product-gate harness, Chrome/Edge targets, renderer dist path and nonzero runtime download evidence.
- Keep existing Web smoke as the save/export/import and diagnostic download proof, and existing Desktop smoke as the Windows launch/input/diagnostics/sandbox proof.
- Document the consolidated external smoke gate in `docs/05_tech/05_testing_observability_ci.md`.

## Risks

- Build smoke can become too broad and slow; keep the assertions attached to the existing e2e package build.
- A second production Web build inside a parallel Web test could race the Desktop package build; avoid adding a competing build writer.
- The smoke must not be mistaken for a public release or signed package.

## Implementation Steps

1. Add stale unpacked artifact seeding and cleanup assertions to Desktop e2e.
2. Add release-gate report assertions to Desktop e2e.
3. Update testing documentation and the WM-0094 report.
4. Run the task-required validation commands.

## Tests And Baselines

- `pnpm test:e2e`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the e2e smoke additions and WM-0094 documentation/report changes. Product decision work remains blocked until external-test smoke evidence is restored.

## Done Conditions

- Windows external-test build cleanup is asserted.
- Web product-gate build evidence is asserted.
- Launch, load, save/export/import where available, input and diagnostics remain covered by e2e.
- M5 product-gate surfaces remain visible in the smoke path.
- Required checks pass and an independent reviewer verifies the task.
