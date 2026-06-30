# WM-0147 Execution Plan

## Goal

Rework the default player HUD so the first playable screen reads as a game:
map first, one objective, one obvious action path, and contextual inspection.
Diagnostics, settings, locale/system preference, fixture/source/hash/verdict
copy, and long explanatory text must move behind explicit secondary surfaces.

## Context

WM-0145 and WM-0146 reset the product bar around first-screen readability and
visible action. The current shell still spreads `Current state`, `Next goal`,
`First-play guidance`, `Current tasks`, `Events`, and `Settings` across the
default HUD, especially in medium and compact layouts. That makes the map feel
secondary and the command path harder to parse.

## Scope

1. Collapse the left-side status wall into a concise objective/action stack.
2. Keep the map lane visually dominant across desktop, medium, and compact
   layouts.
3. Move settings/language/UI-scale access behind an explicit secondary entry.
4. Keep the bottom action bar and selected-object inspector as the main answer
   to "what can I do now?" with disabled reasons preserved.
5. Update unit and web-shell e2e coverage for en and zh-CN at the required
   viewport set.

## Deliverables

- `packages/ui-react/src/shell-hud.ts`
- `packages/ui-react/src/shell-main-menu-surface.ts`
- `packages/ui-react/src/shell-hud.test.ts`
- `apps/web/src/web-shell.e2e.test.ts`
- `coordination/reports/WM-0147.md`

## Verification

Run the required checks:

- `corepack pnpm typecheck`
- `corepack pnpm exec vitest run --exclude=**/*.e2e.test.ts packages/ui-react/src/shell-hud.test.ts`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

## Risks

- Existing assertions currently encode the more verbose HUD and start-surface
  copy, so tests will need deliberate replacement rather than mechanical text
  updates.
- Responsive Playwright checks may need selector changes if the HUD structure
  becomes more map-first and drawer-based.
