# WM-0161 - Formal Playable Product Recovery Roadmap

## Goal

Replace milestone-count progress with a capability-gated product roadmap that
turns the existing simulation foundation into one understandable,
continuously running, saveable colony-sim vertical slice before any future
release-readiness closeout.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0161.json`
- `coordination/project-state.json`
- `coordination/tasks/WM-0154.json` through `WM-0156.json`
- `docs/01_design/00_game_design_overview.md`
- `docs/01_design/12_post_m8_playable_product_acceptance.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/02_systems/06_economy_logistics_production.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/05_tech/02_worker_protocol.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`

## Non-Goals

- No product implementation or protocol/save/schema change.
- No release, platform-verdict or public compatibility decision.
- No claim that historical M0-M8 evidence is invalid.
- No bulk implementation DAG. Only the next reviewed planning entry may be
  created so later work stays phase-gated.

## Current Facts And Assumptions

- M0-M8 preserve valuable deterministic simulation, content, platform and
  engineering evidence, but M8 is internal readiness evidence rather than a
  playable 1.0 product.
- The current Web product path combines a static product-gate world with a
  two-pawn lamp/build Worker slice instead of one integrated town runtime.
- The current normal-speed product path has no continuous autonomous town
  clock, authoritative game save, or reliably reachable real-input command
  chain at every required viewport.
- WM-0154 remains a legacy evidence task; WM-0155 and WM-0156 retain old
  closeout semantics and must not override the new product gates.

## Approach

- Add one authoritative post-M8 product-recovery roadmap with ordered phases,
  architecture target, player outcomes, exit gates, evidence rules, stop signs
  and owner gates.
- Mark M0-M8 as historical capability evidence while preserving all accepted
  hashes, benchmarks and platform decisions.
- Define one continuously running authoritative `GameSession` as the required
  integration target; scenario fixtures become initializers and test assets,
  not separate product runtimes.
- Require real pointer/keyboard input, player-perceptible motion, authoritative
  save/load and a reviewer-observed 30-minute vertical slice before platform
  product-gate re-entry.
- Update the roadmap authority note, readiness matrix status and project state.
- Create only WM-0162 as the non-executed next-phase architecture/task-DAG
  planning entry.

## Risks

- The roadmap could become another documentation artifact without changing
  implementation priorities. Mitigation: explicit stop signs and a single next
  planning task tied to the first integrated runtime gate.
- Reusing historical systems may reveal incompatible scenario-specific
  ownership. Mitigation: require an integration inventory before implementation.
- Product pacing and rendering may be confused with authoritative Tick timing.
  Mitigation: separate simulation state from presentation interpolation while
  requiring observable state transitions.

## Implementation Steps

1. Write the product-recovery roadmap and phase DAG.
2. Update roadmap authority, M8 readiness status and project state.
3. Create the single WM-0162 planning packet for the integrated GameSession
   architecture and first execution DAG.
4. Run documentation/control-plane and full quality checks.
5. Write the work report and request independent reviewer verification.

## Checks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

## Rollback

The roadmap is documentation and control-plane only. Reverting the WM-0161
commit restores the previous roadmap authority without changing product data,
save formats, protocols or runtime state.

## Completion Conditions

Every WM-0161 acceptance criterion maps to the roadmap, authority note,
project-state update, WM-0154 through WM-0156 disposition, and the single
non-executed WM-0162 planning packet. Independent reviewer verification is
required before integration.
