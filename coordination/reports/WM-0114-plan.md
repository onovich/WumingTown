# WM-0114 - Localization infrastructure and missing-key gate

## Goal

Add a narrow zh-CN/en localization layer for the current client shell with
browser-language detection, manual override persistence, missing-key validation,
and dev-only diagnostics gating without changing simulation or save authority.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0114.json`
- `coordination/reports/WM-0111-m8-scope-amendment.md`
- `docs/05_tech/12_m8_i18n_locale_contract.md`
- `coordination/decisions/ADR-0011.md`
- `docs/01_design/09_m8_product_ui_design_system.md`
- Current shell files in `apps/web`, `apps/desktop-electron`, `packages/ui-react`,
  `tools`, and root `package.json`

## Non-Goals

- No changes to `sim-core`, `sim-worker`, `sim-protocol`, or save schema.
- No full player-copy migration or full translation/content pass.
- No release, store, signing, telemetry, account, cloud-sync, or paid-service
  work.
- No broad Electron preload bridge or generic host filesystem exposure.

## Current Facts And Assumptions

- The current shell has hard-coded English-heavy UI copy and no locale
  preference model.
- Web and desktop renderer paths share the same React shell, so a renderer-side
  locale preference can cover both surfaces.
- Default UI still exposes diagnostics and product-gate language as a primary
  surface, which conflicts with WM-0111 and ADR-0011.
- WM-0121 is unmerged and unrelated to this task; this work must not depend on
  it or revert around it.

## Approach

- Add locale contracts, catalog resources, template formatting, and validation in
  `packages/ui-react`.
- Add a small shell locale controller in `apps/web` that resolves locale from
  manual preference plus browser candidates and persists `LocalePreferenceV1`
  only in renderer storage.
- Add a localized language/settings surface in the shell HUD and hide developer
  diagnostics behind an explicit debug surface instead of the default player UI.
- Add a reusable localization validation script wired into root scripts and unit
  tests for locale resolution, storage recovery, and missing-key completeness.
- Extend web and desktop e2e to verify locale defaults, manual persistence, and
  dev-surface isolation.

## Risks

- Existing shell e2e depends on diagnostic panels being visible by default, so
  tests must be updated carefully while preserving debug coverage.
- The current read-model fixture still carries English content strings; this
  task should localize shell chrome only and leave content migration to WM-0115.
- Electron locale persistence across restart can be flaky unless the test owns a
  stable `userData` directory.

## Implementation Steps

1. Add locale model, catalogs, translation helpers, and catalog validation.
2. Add browser candidate reading plus localStorage preference read/write with
   structured failure recovery.
3. Extend shell state/actions with locale settings and diagnostics visibility.
4. Localize shell chrome and move diagnostic-only surfaces behind explicit dev
   access.
5. Add unit, validator, and e2e coverage.
6. Run required gates and write the task report.

## Tests And Checks

- Focused unit tests for locale resolution, preference storage, and catalog
  validation.
- Focused e2e for `web-shell` and `desktop-shell`.
- Required task checks:
  - `node tools/validate-handoff.mjs`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
  - `git diff --check`
  - `pnpm quality`

## Rollback

- Remove the locale controller, catalog resources, validator script, and shell
  settings surface.
- Restore the previous always-visible diagnostic presentation if needed without
  changing save or simulation contracts.

## Done Conditions

- Locale resolution follows ADR-0011 detection and manual-override rules.
- Manual override persists as renderer presentation state only.
- Missing player-visible keys or missing zh-CN/en translations fail validation.
- Default player UI no longer exposes diagnostic harness labels by default.
- Web and desktop tests prove locale defaults and persistence behavior.
