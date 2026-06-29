# WM-0145 - Product UX blocker reopen plan

## Goal

Record the Owner post-closeout product UX blocker and create a reviewed,
non-executed remediation DAG that treats player-perceptible NPC action and a
real lamp/build command loop as minimum product gates.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/project-state.json`
- `coordination/reports/WM-0129-art-consultation.md`
- `coordination/reports/WM-0138.md`
- `coordination/reports/WM-0142.md`
- `coordination/tasks/*.json`
- `docs/01_design/00_game_design_overview.md`
- `docs/01_design/03_daily_loop_and_pacing.md`
- `docs/01_design/05_ui_ux_information_design.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/02_systems/06_economy_logistics_production.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`

## Non-Goals

- Do not implement product UI, Pixi, Worker, protocol, sim-core or save changes.
- Do not claim the current Web shell is playable-product ready.
- Do not start, claim or execute WM-0146 through WM-0156.
- Do not change Web `demo-only`, Windows unsigned controlled-test, public
  release, EA, store, signing, telemetry, accounts, paid service or public save
  compatibility gates.

## Current Facts

- WM-0142 closed the previous UI/playability remediation evidence, but recorded
  that the WM-0138 playable chain remained shell-local and non-authoritative.
- `PLAYER_COMMAND_KIND` currently exposes only `Noop` and `Echo`.
- The Web shell uses a static product-gate read-model; the current UI does not
  yet expose a product-grade RimWorld-like order/job/build loop.
- Owner feedback after closeout states that the UI is overwhelming, lacks
  clear player goals, does not feel like a game, and fails to show how to build
  or drive characters to work.
- The art thread was asked for a second UX consultation and replied that visible
  NPC action is a hard product gate, not polish.

## Approach

1. Record the blocker honestly and correct the acceptance standard.
2. Incorporate the art thread guidance into the task report.
3. Create proposed follow-up task packets:
   - product UX spec and first-five-minute goal,
   - HUD hierarchy repair,
   - semantic map and pawn state layer,
   - authoritative command/job protocol design,
   - headless lamp/build execution,
   - renderer motion/job markers,
   - player lamp/build UI chain,
   - localization/responsive first-play repair,
   - visual/E2E evidence gate,
   - verdict update and closeout.
4. Keep all downstream tasks in `proposed` until WM-0145 is reviewed and done.

## Risks

- Product risk: another UI pass could still optimize panels rather than the
  player action loop. Mitigation: make visible pawn action and command-to-job
  evidence explicit acceptance in every downstream implementation task.
- Architecture risk: UI could fake action locally. Mitigation: separate
  authoritative command/job work from renderer/HUD work.
- Scope risk: the requested fix is larger than a polish pass. Mitigation:
  split into reviewed tasks and preserve owner-gated release boundaries.

## Checks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`

## Done Criteria

- WM-0145 report records Owner critique, current facts, art-thread feedback and
  the corrected product acceptance standard.
- WM-0146 through WM-0156 exist as proposed, non-executed tasks with scoped
  docs, acceptance, checks and forbidden paths.
- Required checks pass.
- WM-0145 is completed for independent reviewer verification.
