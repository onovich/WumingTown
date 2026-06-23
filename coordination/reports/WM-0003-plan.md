# WM-0003 - Build the Web client rendering and UI shell

## Goal

Create a browser-playable M0 shell where Pixi owns the world canvas, React owns the HUD and selected-entity inspector, and Chromium smoke coverage proves deterministic rendering from static read-model data.

## Read Context

- `AGENTS.md`
- `PLANS.md`
- `coordination/tasks/WM-0003.json`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `docs/01_design/05_ui_ux_information_design.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/05_tech/02_worker_protocol.md`
- `apps/web/package.json`
- `apps/web/src/index.ts`
- `packages/renderer-pixi/package.json`
- `packages/renderer-pixi/src/index.ts`
- `packages/ui-react/package.json`
- `packages/ui-react/src/index.ts`

## Non-Goals

- No authoritative simulation, gameplay rules, save behavior, command protocol execution, or Worker lifecycle beyond static smoke data.
- No per-cell React or DOM map rendering.
- No Electron work, content compiler work, or changes outside `D:/WebProjects/WumingTown-WM-0003`.
- No architectural expansion beyond reusable renderer/UI package APIs needed by the web shell.

## Current Facts And Assumptions

- Verified worktree: `D:/WebProjects/WumingTown-WM-0003`.
- Verified branch: `task/WM-0003-web-client-shell`.
- `apps/web`, `packages/renderer-pixi`, and `packages/ui-react` currently export only smoke constants.
- The architecture doc explicitly requires Pixi chunk rendering for terrain/world and React-only UI overlays.
- The Worker protocol doc allows M0 read-model snapshots and on-demand UI detail as separate concerns; this task can use static read-model data while treating the authoritative service as remote.
- Assumption: adding exact-pinned runtime dependencies for React, Pixi, Playwright, and Vite web entry support is allowed within WM-0003 scope if boundary-safe and required to satisfy acceptance.

## Approach

1. Define a small shared read-model contract in public package APIs so the renderer and HUD consume the same static world/entity data without depending on sim internals.
2. Build `renderer-pixi` as a reusable canvas-shell package that renders chunked terrain, entity markers, selection highlights, and pointer selection against chunk geometry rather than per-tile objects.
3. Build `ui-react` as a reusable HUD/inspector package that renders viewport/input state and selected-entity detail from the read model only.
4. Compose both in `apps/web` with a real browser entry, seeded smoke data, resize handling, and deterministic viewport defaults.
5. Add unit coverage for renderer/UI wiring where practical, then add Playwright smoke that launches Chromium, waits for a stable frame, and writes a deterministic screenshot artifact.

## Risks

- Visual determinism: text, antialiasing, or device-pixel-ratio differences can make the smoke screenshot flaky unless viewport, fonts, animation timing, and renderer scale are controlled.
- Scope: pulling in browser runtime dependencies can ripple into lint/typecheck/build setup, so package changes must stay tight.
- Compatibility: supported Chromium resize/input behavior must work without relying on APIs unavailable in Playwright's bundled browser.
- Boundary hygiene: read-model types must stay in public package surfaces and avoid backsliding into sim-worker or app-internal deep imports.

## Implementation Steps

1. Add exact runtime/dev dependencies and any root/test config needed for a real web entry plus Playwright e2e execution.
2. Introduce shared shell read-model types and static smoke data entrypoints.
3. Implement Pixi renderer package APIs and tests.
4. Implement React HUD/inspector package APIs and tests.
5. Compose the web app shell, styles, resize/input plumbing, and deterministic screenshot hooks.
6. Add/update e2e smoke coverage and artifact output.
7. Run the full owner gate, update `coordination/reports/WM-0003.md`, and leave the task claimed without calling `taskctl complete`.

## Tests And Baselines

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm lint`
- `pnpm content:validate`
- `pnpm boundaries:check`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`

## Rollback

Revert WM-0003 changes in the web app, renderer/UI packages, test/config files, and report artifacts; no authoritative simulation state or save migration should be affected.

## Done Conditions

- Pixi renders a chunked test map through reusable `renderer-pixi` APIs without per-cell React components.
- React renders a selected-entity inspector from a static read model through reusable `ui-react` APIs.
- Canvas and HUD resize/input behavior work in Chromium and are exercised by automated smoke coverage.
- `pnpm test:e2e` captures a deterministic screenshot artifact, and all required owner-gate checks pass or are explicitly blocked with evidence.
