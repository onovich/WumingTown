# WM-0136 Plan

## Scope

Implement client-side world selection remediation within the WM-0136 allowed
paths only. Keep selection and inspect feedback as local presentation state in
the Web shell, React HUD and Pixi renderer. Do not add UI-owned authoritative
world mutation or expand Worker/public protocol beyond reviewed read-model
presentation needs.

## Observed baseline

- `apps/web/src/shell-bootstrap.ts` already syncs local `selectedEntityId` and
  `lastInputLabel` between Pixi and the React shell store.
- `packages/renderer-pixi/src/pixi-world-renderer.ts` already hit-tests entity
  clicks and emits `Canvas select <entityId>` or `Canvas inspect x,y`, but the
  visible feedback is entity-ring-only and empty-tile feedback is not promoted
  into a meaningful HUD inspect state.
- `packages/ui-react/src/shell-hud.ts` only renders a selected-entity inspector
  or a generic no-selection empty state, so empty-tile clicks read as silent
  failure from the player perspective.
- Existing Playwright coverage proves basic canvas selection, but it does not
  explicitly cover empty-tile inspect feedback, object coverage expectations, or
  selection behavior across both windowed and fullscreen-equivalent viewports.

## Planned changes

1. Extend the shell presentation state so the HUD can represent either a
   selected entity or an inspected empty tile using localized feedback.
2. Update Pixi selection rendering so clickable entities and empty-tile inspect
   actions both produce visible spatial feedback without mutating world state.
3. Keep overlay pointer behavior non-blocking for the map except over real UI
   controls, and prove it with targeted E2E assertions.
4. Add or refine tests around renderer/web-shell selection flows for both a
   compact windowed viewport and a fullscreen-equivalent viewport.

## Verification plan

- `corepack pnpm test --filter web-shell`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `corepack pnpm typecheck`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `corepack pnpm quality`

If E2E refreshes `coordination/artifacts/WM-0118/**`, restore those files
before final completion because they are outside WM-0136 allowed paths.
