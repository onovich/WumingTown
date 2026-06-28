# WM-0133 Execution plan

## Scope

- Implement reusable post-M8 shell design tokens inside `packages/ui-react/src`.
- Apply the token language to player HUD surfaces, alerts, resource cards,
  resident cards, inspector details, settings surfaces and a non-gameplay
  command-bar placeholder.
- Preserve WM-0134 localization behavior and avoid English leakage in zh-CN
  HUD output.
- Stay within allowed paths and avoid new runtime dependencies, final art
  assets or gameplay-semantics changes.

## Planned file touch set

- `packages/ui-react/src/shell-design-tokens.ts`: shared token values and style
  helpers for paper, wood, ink, lamp, status, buttons and semantic slots.
- `packages/ui-react/src/shell-hud.ts`: tokenized HUD surfaces, alert strip,
  resource/resident/inspector refresh and command-bar placeholder.
- `packages/ui-react/src/shell-main-menu-surface.ts`: button and surface styles
  aligned with the new token system where it shares the same shell chrome.
- `packages/ui-react/src/shell-settings-panel.ts`: shared settings surface and
  control styling.
- `packages/ui-react/src/localization.ts`: only if new shell UI labels are
  required for the command-bar placeholder or semantic status copy.
- `packages/ui-react/src/shell-hud.test.ts` and `apps/web/src/web-shell.e2e.test.ts`:
  focused assertions for semantic slots, disabled placeholder explanations and
  accessible style-state behavior.

## Acceptance approach

1. Centralize token names instead of scattering raw hex, radius and spacing
   values across the shell.
2. Shift the HUD toward B layout / C mood / A+C lamp-path language with
   playable ledger-like surfaces rather than marketing-page framing.
3. Keep radii at or below 8px, avoid cards-inside-cards, and keep key text
   contained at compact and desktop viewports.
4. Expose semantic slot identifiers on style-relevant surfaces/buttons where
   useful for tests and future asset replacement.

## Required validation

- `corepack pnpm typecheck`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `corepack pnpm quality`

## Risks to watch

- The existing HUD file is already large; token extraction should reduce style
  churn rather than deepen duplication.
- zh-CN fixture localization must keep using the WM-0134 adapter; no new direct
  English strings should appear in player-facing zh-CN HUD text.
- The command-bar placeholder must stay clearly non-authoritative and
  non-gameplay while still exercising the new component language.
