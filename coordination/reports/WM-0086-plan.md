# WM-0086 - Add Web Build And Release-Gate Harness

## Goal

Replace the tiny web smoke shell baseline with a repeatable Web product-gate
harness rooted in reviewed M5/M4 evidence, while keeping Web UI, Pixi and
React as read-only consumers.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0086.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0085.md`
- `docs/02_systems/19_m5_alpha_content_framework_scenario.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `coordination/artifacts/WM-0080/m5-alpha-scenario-summary.json`
- `coordination/artifacts/WM-0067/m4-core-vertical-slice-summary.json`

## Non-Goals

- No `packages/sim-core/**` edits.
- No Worker protocol, save compatibility or schema redesign.
- No M7 content, hosting, store or public playtest work.
- No new runtime dependency or server requirement.
- No UI authority or simulation mutation path.

## Current Facts And Assumptions

- The current `apps/web` shell mounts a 24x16 smoke read model and proves only
  basic Pixi/HUD input behavior.
- M6 Web release-gate target assumptions are documented as a 192x192 vertical
  slice, 40 active actors, 20k entities, lamp/evidence/event surfaces, Chrome
  and Edge targets, and cross-origin-isolation-sensitive SharedArrayBuffer
  behavior.
- WM-0086 is not the performance gate. It should create the harness and record
  assumptions so WM-0087 can measure from the same product-gate surface.
- The reviewed M5 alpha evidence provides stable scenario facts, hashes,
  strategy paths and anomaly/faction/governance/event evidence that can root a
  deterministic fixture without making the browser shell authoritative.
- `@wuming-town/sim-protocol` Web read models are intentionally narrow, so any
  extra harness metadata should stay local to the Web shell rather than forcing
  a public protocol expansion in WM-0086.

## Approach

1. Replace the current smoke fixture with a deterministic product-gate fixture:
   - 192x192 map and chunk layout.
   - Meaningful entity population and terrain landmarks.
   - M5/M4-derived labels and inspector facts rooted in reviewed summary
     artifacts and scenario docs.
2. Add a Web-only harness descriptor beside the read model so the shell can
   expose:
   - source evidence ids and hashes;
   - Chrome/Edge target assumptions;
   - bundle-size, asset and cross-origin-isolation assumptions;
   - explicit note that SAB performance/storage gates are deferred to later M6
     tasks.
3. Keep the renderer and HUD consuming read-model state plus read-only harness
   metadata only. No browser authority, no simulation writes.
4. Add a repeatable build-side harness report for `pnpm build:web` so the task
   leaves concrete artifact evidence instead of only a live dev-shell view.
5. Expand the Playwright `web-shell` flow to assert the richer harness surface
   and preserve observable user behavior.

## Risks

- A richer fixture could still look like a static mock if it does not cite M5
  evidence clearly enough.
- Bundle/report tooling could drift from actual build output if it is not wired
  directly to the built asset tree.
- The current Pixi renderer is not yet the later performance-optimized path, so
  WM-0086 must avoid over-claiming perf readiness and leave measurement to
  WM-0087.

## Implementation Steps

1. Add the deterministic product-gate fixture and harness metadata under
   `apps/web/src`.
2. Update the shell bootstrap and HUD to present the fixture, provenance and
   target assumptions without widening authority.
3. Add a Web build harness script/report under `tools/**web**` and wire it into
   the Web build flow.
4. Update the focused `web-shell` e2e to validate the harness is not the old
   empty smoke page.
5. Write `coordination/reports/WM-0086.md` with acceptance evidence and
   assumptions.

## Tests And Checks

Required WM-0086 checks:

- `pnpm typecheck`
- `pnpm build:web`
- `pnpm test:e2e --filter web-shell`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert WM-0086 Web harness changes in `apps/web`, `packages/ui-react`,
`packages/renderer-pixi`, `packages/platform`, `tools/**web**` and the WM-0086
reports. Do not touch unrelated M6 task packets or runtime authority.

## Done Conditions

- Web build has a repeatable release-gate harness artifact or command.
- The harness renders meaningful M5/M4-derived product-gate content instead of
  the old tiny smoke shell alone.
- Chrome/Edge and cross-origin-isolation assumptions are recorded in product
  code/docs/report.
- Bundle-size and asset assumptions are recorded from the actual Web build.
- UI, Pixi and React remain read-model consumers only.
