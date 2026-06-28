# WM-0131 Execution Plan

## Task Scope

WM-0131 is an architecture/design contract task. It will not implement product
code, import art files, create external art licensing commitments, change public
release or platform verdicts, or alter Simulation Worker authority.

## Inputs

- `coordination/tasks/WM-0131.json`
- `coordination/reports/WM-0129.md`
- `coordination/reports/WM-0129-art-consultation.md`
- `coordination/reports/WM-0129-remediation-dag.md`
- `docs/01_design/09_m8_product_ui_design_system.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- Downstream task packets for WM-0132, WM-0133, WM-0135 and WM-0140

## Work Plan

1. Confirm task control-plane state and allowed paths with `taskctl`.
2. Preserve the art consultation sourcing record:
   B layout; C visual mood; A+C map lamp/path language; B resident list; C+A
   inspector; B+C command bar.
3. Add a durable post-M8 asset replacement contract under `docs/01_design/`.
4. Define semantic tokens, component hierarchy, manifest fields, slot naming
   and future cut-in replacement rules without baking final images into product
   logic.
5. Record high-cost art work that remains out of scope for this remediation
   pass.
6. Add explicit integration guidance for WM-0132, WM-0133, WM-0135 and WM-0140.
7. Write the WM-0131 work report and run all required checks.
8. Complete through `taskctl complete` and leave the task in reviewer handoff,
   not `done`.

## Architecture Gates

- UI and Pixi remain read-model consumers and command/request emitters.
- Asset discovery is manifest-driven; no global scans or hidden shared state.
- Manifest versions and fallback slots prevent unversioned caches.
- Locale text stays in i18n; images do not contain player-visible text.
- External licensing is represented only as owner-gated metadata, not approval.
- No new runtime dependency is introduced.

## Required Checks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `corepack pnpm quality`

