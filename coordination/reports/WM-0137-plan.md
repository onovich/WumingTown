# WM-0137 Plan

## Scope

Add player-facing camera controls to the Pixi world renderer and Web shell tests:
mouse drag pan, wheel zoom, keyboard pan/zoom, reset-to-fit, bounds behavior and
localized input feedback. Keep the work inside renderer/UI/Web presentation
paths. Do not change simulation authority, save contracts, release verdicts or
platform status.

## Baseline Read

- WM-0130 marks camera drag/reset as blocked: wheel zoom and keyboard pan/zoom
  exist, but mouse drag pan, reset affordance and clearer evidence are missing.
- `render-geometry.ts` already owns fitted, pan, zoom and clamp behavior.
- `pixi-world-renderer.ts` already emits `lastInputLabel`, selection state,
  hover tile and debug viewport data to the shell store.
- Existing E2E checks keyboard and wheel-adjacent state only lightly; it does
  not prove drag pan or reset.

## Planned Changes

1. Add geometry helpers for reset-to-fit and bounded viewport inspection if
   needed by tests.
2. Add pointer drag state to `pixi-world-renderer.ts`:
   - short stationary pointer down/up remains selection;
   - movement beyond a small threshold becomes drag pan;
   - drag captures/release pointer safely;
   - panning is bounded by `clampViewport`.
3. Add reset control:
   - keyboard `Digit0`, `Numpad0` and `Home`;
   - exported renderer method if the HUD needs a button later.
4. Improve camera feedback labels through existing `lastInputLabel` localization
   adapter.
5. Add renderer geometry/unit tests and Web E2E coverage for drag, wheel,
   keyboard and reset without relying on simulation state changes.

## Verification Plan

- `corepack pnpm exec vitest run packages/renderer-pixi/src/render-geometry.test.ts`
- focused `web-shell` E2E for camera behavior
- `node tools/test-runner.mjs e2e --filter web-shell`
- task required checks, recording unsupported legacy filter commands if still
  unsupported:
  - `corepack pnpm test --filter web-shell`
  - `corepack pnpm test --filter map-grid`
  - `corepack pnpm typecheck`
  - `node tools/validate-handoff.mjs`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `corepack pnpm quality`
