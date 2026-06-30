# WM-0148 - Semantic map readability and visible pawn state layer

## Goal

Make the Web world view read like a playable colony-sim map by projecting
semantic terrain/object cues and low-fidelity but explicit pawn state evidence
without changing authoritative simulation ownership.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0148.json`
- `coordination/reports/WM-0145.md`
- `coordination/reports/WM-0146.md`
- `docs/01_design/12_post_m8_playable_product_acceptance.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `packages/sim-protocol/src/web-read-model.ts`
- `packages/renderer-pixi/src/*`
- `apps/web/src/product-gate-fixture.ts`
- `apps/web/src/shell-bootstrap.ts`

## Non-Goals

- No `sim-core` runtime or authoritative job execution changes.
- No new player command protocol semantics beyond current reviewed shell-local
  placeholder feedback.
- No React/Electron authority bypass, release/store/signing/telemetry/account
  work, or WM-0150-owned authoritative slice changes.
- No HUD-system redesign outside the data needed for the map projection layer.

## Current Facts And Assumptions

- The current Pixi renderer draws chunk terrain fills, entity shapes, selection
  and hover, but no semantic area overlays, intent paths, job markers, progress
  cues or state badges.
- The current Web fixture already acts as a read-only playable slice fixture and
  is the safest place to seed semantic map and pawn-state evidence for this
  task.
- `ui-react` already surfaces selected-entity job text, so WM-0148 can focus on
  map readability and visible projection data without editing the HUD package.
- Later WM-0150/WM-0151 need stable projection fields for real movement/work,
  so new read-model state should be additive and renderer-owned, not shell
  invention.

## Approach

- Extend the web read-model with additive optional projection surfaces for:
  semantic map areas, selectable target hints, pawn visual state, projected job
  markers, path previews and progress evidence.
- Seed the Web product-gate fixture with a concentrated dusk lamp/build slice:
  roads, structures, lamp coverage, dark gaps, blocked spans, selectable
  objects, and multiple pawns in idle/moving/working/blocked/completed states.
- Add pure geometry helpers for semantic-area bounds, path projection and marker
  placement so tests can verify viewport behavior without Pixi internals.
- Update the Pixi renderer to consume only the read model and draw:
  structure footprints, lamp coverage glow rings, dark-gap hatching, blocked
  marks, selectable outlines, path/intent lines, target job markers, progress
  bars, and per-pawn state badges that use shape/text plus color.

## Risks

- Adding required protocol fields would cascade into unrelated packages, so all
  new read-model fields should be optional.
- Overdrawing too many per-tile objects would regress renderer cost; semantic
  overlays should use bounded area graphics and per-entity markers only.
- The current shell remains static; the fixture must clearly communicate that
  visible state is placeholder evidence, not authoritative simulation.

## Implementation Steps

1. Extend `packages/sim-protocol/src/web-read-model.ts` and exports with
   additive projection types.
2. Update `apps/web/src/product-gate-fixture.ts` to populate semantic map and
   pawn-state evidence for the reviewed slice.
3. Add geometry helpers and tests in `packages/renderer-pixi/src/render-geometry.ts`
   and `render-geometry.test.ts`.
4. Update `packages/renderer-pixi/src/pixi-world-renderer.ts` to draw the new
   overlays from read-model data only.
5. Run required checks, write `coordination/reports/WM-0148.md`, and
   `taskctl complete`.

## Tests And Checks

- `corepack pnpm typecheck`
- `corepack pnpm exec vitest run --exclude=**/*.e2e.test.ts packages/renderer-pixi/src/render-geometry.test.ts`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

## Rollback

Revert the additive read-model/fixture/renderer changes in this task branch.
Because authority stays unchanged, rollback only removes projection evidence and
does not require save or protocol migration.

## Done Conditions

- Roads, structures, lamp coverage, dark gaps, blocked areas and selectable
  objects are visually distinct in the Web world view.
- Pawn states show idle, moving, working, blocked and completed evidence on the
  map.
- Hover, selection, intent/path, job marker and progress cues are distinct and
  not color-only.
- Renderer stays read-model-only.
- Geometry tests cover the new projection helpers and required checks pass.
