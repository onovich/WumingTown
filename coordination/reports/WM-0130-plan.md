# WM-0130 Plan

## Scope

Audit the current post-M8 Web shell for UI interaction, locale behavior,
responsive evidence quality, and minimum playable interaction readiness without
changing product code.

## Allowed outputs

- `coordination/reports/WM-0130-plan.md`
- `coordination/reports/WM-0130.md`
- task state updates through `taskctl`

## Evidence sources

1. Task packet and upstream reports:
   - `coordination/tasks/WM-0130.json`
   - `coordination/reports/WM-0129.md`
   - `coordination/reports/WM-0129-owner-blocker-record.md`
   - `coordination/reports/WM-0129-art-consultation.md`
   - `coordination/reports/WM-0129-remediation-dag.md`
2. Design and locale contracts:
   - `docs/01_design/09_m8_product_ui_design_system.md`
   - `docs/01_design/10_m8_first_play_guidance.md`
   - `docs/05_tech/12_m8_i18n_locale_contract.md`
3. Code inspection:
   - `apps/web/src/*`
   - `packages/ui-react/src/*`
   - `packages/renderer-pixi/src/*`
   - `packages/sim-protocol/src/*`
4. Existing responsive artifacts:
   - `coordination/artifacts/WM-0118/web-responsive-layout.json`
   - `coordination/artifacts/WM-0118/desktop-responsive-layout.json`
   - curated screenshots already committed under `coordination/artifacts/WM-0118/`
5. Runtime confirmation that does not create new task-external artifacts:
   - existing `web-shell` E2E behavior
   - local one-off zh-CN HUD text sampling without writing screenshots

## Audit method

1. Confirm whether the visible default launch is still a diagnostics harness,
   a player-facing main menu, or a player HUD.
2. Trace selection, hover, pointer-event layering, shell button clickability,
   and empty-tile feedback from Pixi input to React output.
3. Trace camera behavior for wheel, keyboard, drag, and reset affordances.
4. Trace locale detection, manual switching, persistence, diagnostics
   isolation, catalog validation, and remaining player-visible hardcoded prose.
5. Compare current responsive evidence against reviewer needs, especially where
   reachability assertions may hide poor simultaneous visibility.
6. Decide whether a minimum playable interaction chain exists or is blocked by
   protocol or adapter gaps.

## Guardrails

- No product-code edits unless audit-only evidence becomes strictly necessary.
- Do not keep or regenerate `WM-0118` artifacts inside this task branch.
- If a verification command touches paths outside WM-0130 allowedPaths, restore
  those paths to `HEAD` before continuing and record that restoration in the
  report.
