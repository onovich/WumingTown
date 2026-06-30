# WM-0151 Plan

## Objective

Make the Web/Pixi shell show player-readable autonomous pawn action from reviewed
Worker/read-model data so the first read is "map plus acting pawns", not a
diagnostic wall. After a reviewed command, the player must be able to see:

1. Job marker appears.
2. A pawn claims the work.
3. The pawn moves along a visible path / intent line.
4. The pawn works at the target with visible progress.
5. The outcome resolves to completed or blocked with an explainable reason.

All product surfaces must remain read-model consumers only. No UI-owned
authoritative world mutation. No new unreviewed command semantics.

## Hard acceptance to carry into implementation and report

- Product minimum is not a diagnostics/status board. NPCs must visibly act in a
  way a player can understand.
- Low-fidelity dots/pawns are acceptable, but idle / moving / working /
  blocked / completed must be distinguishable without relying on color alone.
- After lamp/build/priority commands the flow must visibly progress from marker
  spawn to pawn claim, motion, target progress, and completed or blocked reason.
- The main read must stay on the map and moving pawns. Inspector only explains
  the selected pawn/object current work, step, target, progress, and reason.
- Review evidence must include automated Web E2E and screenshots/artifacts that
  prove command-related motion/progress, not only static selection feedback.

## Planned changes

1. Replace the current `wm0138` local playable command placeholder in
   `apps/web/src/**` with a reviewed projection harness that stays inside legal
   package boundaries and never imports `sim-core` internals from Web.
2. Add a small Web-side projection adapter that converts reviewed structured
   command/job/pawn snapshot data into the `WorldReadModel` + inspector
   structures consumed by Pixi and React.
3. Extend `packages/sim-protocol/src/**` read-model types as needed for
   structured command/job/pawn explanation fields, keeping changes additive and
   reviewable.
4. Rework `packages/renderer-pixi/src/**` so the map remains dominant while
   intent lines, target markers, job marker states, progress rings/bars and
   blocked/completed cues are readable, shape-distinct and allocation-bounded.
5. Rework `packages/ui-react/src/**` inspector/objective surfaces so the
   selected pawn/object explains current job, current step, target, progress,
   blocked/completed/failure reason from structured data, while reducing the
   feeling of a diagnostic wall.
6. Update Web E2E to drive a real reviewed command path through the Worker and
   assert motion/progress evidence over time, then capture screenshots/artifacts
   for reviewer inspection.

## Implementation notes

- Keep the simulation authoritative in `Simulation Worker` only. Web/React/Pixi
  remain read-only consumers; the WM-0151 Web harness must not pose as the
  authoritative runtime.
- Reuse reviewed command/job/pawn semantics and project them as read-model
  slices. Do not invent extra command kinds or UI-owned authoritative job
  state.
- Keep render costs bounded by rebuilding narrow projection data only when read
  model changes; avoid per-frame/per-entity allocation growth and per-sprite
  tickers.
- If `web-shell` E2E updates out-of-scope report artifacts, restore those files
  before completion so the final diff stays inside allowed paths.

## Planned evidence

- Map inspection in code:
  `apps/web/src/**`, `packages/renderer-pixi/src/**`, `packages/ui-react/src/**`
  show the reviewed command -> job -> pawn -> progress -> result chain.
- Automated Web E2E:
  `node tools/test-runner.mjs e2e --filter web-shell` proves command-related
  motion/progress and not only selection feedback.
- Required checks:
  `corepack pnpm typecheck`
  `corepack pnpm exec vitest run --exclude=**/*.e2e.test.ts packages/renderer-pixi/src/render-geometry.test.ts`
  `node tools/test-runner.mjs e2e --filter web-shell`
  `node tools/validate-handoff.mjs`
  `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
  `git diff --check`
  `corepack pnpm quality`
