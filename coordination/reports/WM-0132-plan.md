# WM-0132 Execution plan

## Scope

- Keep the default Web shell path player-facing by removing remaining
  fixture/product-harness wording from the main menu and player HUD flow.
- Preserve the existing explicit diagnostics route (`wmDiagnostics=1`) while
  making the diagnostics/debug surface more clearly separate from the player
  HUD.
- Stay inside allowed paths and keep React as a read-model consumer only.

## Planned file touch set

- `packages/ui-react/src/shell-hud.ts`: tighten player HUD versus diagnostics
  separation and keep the HUD composition focused on phase, next goal,
  resources, residents, selected detail and action placeholders.
- `packages/ui-react/src/localization.ts`: replace remaining player-visible
  fixture-facing copy with player-facing wording.
- `packages/ui-react/src/shell-hud.test.ts`: assert the default route avoids
  product-gate/fixture leakage while the explicit diagnostics route exposes the
  debug overlay.
- `apps/web/src/web-shell.e2e.test.ts`: assert the default player HUD remains
  clean while the explicit diagnostics route keeps debug-only surfaces
  available.
- `coordination/reports/WM-0132.md`: final implementation/check report after
  verification.

## Acceptance approach

1. Keep the default start surface and player HUD centered on current phase,
   next goal, alerts, resources, residents, selected detail and player actions.
2. Leave release-gate, fixture id, storage-gate and diagnostic evidence inside
   the explicit diagnostics/debug route only.
3. Avoid new authority, protocol, save-schema or Worker changes; this remains a
   presentation/read-model task.
4. Strengthen automated evidence so reviewer inspection can distinguish default
   HUD behavior from diagnostics-mode behavior.

## Required validation

- `corepack pnpm typecheck`
- `corepack pnpm test --filter web-shell`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `corepack pnpm quality`

## Risks to watch

- Default player-facing copy must not regress into M6/M8 harness wording while
  still remaining truthful about the controlled shell scope.
- Diagnostics-mode assertions must stay explicit without requiring reviewer-only
  artifact paths in the final diff.
- E2E can refresh `coordination/artifacts/WM-0118/**`; if that happens, those
  files must be restored before task completion.
