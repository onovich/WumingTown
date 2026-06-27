# WM-0099 Execution Plan

## Task

WM-0099 - Tutorial onboarding and first-run player path.

## Scope

- Add a first-run onboarding path to the existing Web/Windows shell HUD.
- Keep the path read-model-only: no Simulation Worker, `sim-core`, Worker
  protocol or save schema changes.
- Cover launch, movement/input, time control, residents/work, hauling/building,
  saving, events, lamps, Chronicle, town rules, evidence and structured failure
  explanations.
- Preserve M6 verdict language: Web is `demo-only`, Windows is unsigned
  `ready-for-controlled-external-test`.

## Inputs

Required task inputs read:

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0099.json`
- `coordination/reports/WM-0097.md`
- `coordination/reports/WM-0097-future-m7-entry-prompt.md`
- `coordination/reports/WM-0098-m7-task-dag.md`
- `docs/02_systems/07_chronicle_evidence_knowledge.md`
- `docs/02_systems/08_anomalies_rules_investigation.md`
- `docs/02_systems/09_obligations_pacts_factions.md`
- `docs/02_systems/10_ordinances_governance_identity.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/00_roadmap.md`

Missing task input paths:

- `docs/01_design/00_product_brief.md`
- `docs/01_design/03_player_experience.md`

Substitute design inputs used:

- `docs/01_design/00_game_design_overview.md`
- `docs/01_design/02_player_journey_and_story.md`
- `docs/01_design/03_daily_loop_and_pacing.md`
- `docs/01_design/05_ui_ux_information_design.md`

## Implementation Steps

1. Add typed onboarding state to `packages/ui-react`.
2. Render an M7 first-run onboarding panel inside the existing product-gate HUD
   card.
3. Initialize Web shell onboarding copy from the app shell.
4. Add Web and desktop Electron smoke assertions for the onboarding path.
5. Record copy limits and unresolved risks in design/report artifacts.
6. Run WM-0099 required checks and route to independent reviewer.

## Non-Goals

- No M8 tutorial/content volume.
- No public release, store submission, signing, installer, updater, telemetry,
  accounts, paid service, crash upload or public feedback system.
- No authoritative UI/Electron world mutation.
- No Web same-spec/lower-fast-forward/lower-cap claim.
