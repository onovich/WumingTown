# WM-0119 Plan

## Scope

Extend the M7 first-run onboarding into an M8 first-play guidance surface that
is visible to players by default and remains separate from developer
diagnostics.

Allowed implementation paths:

- `packages/ui-react/**`
- `apps/web/**`
- `apps/desktop-electron/**` only if Electron tests need matching evidence
- `docs/01_design/**`
- `docs/04_content_balance/**`
- `coordination/reports/WM-0119*.md`

Forbidden paths remain out of scope:

- `packages/sim-core/**`
- `packages/sim-worker/**`
- release, store, signing, telemetry, account or paid-service work

## Implementation Steps

1. Add player-facing first-play guidance to the default UI path.
   - The default start surface must explain current phase, available actions and
     next goal before the player dismisses it.
   - The in-game HUD must keep phase, next goal, current tasks, resident
     pressure and explainability visible after dismissal.

2. Keep diagnostics isolated.
   - `Web Product Gate`, storage gate details and diagnostic package controls
     remain gated behind explicit diagnostics mode.
   - Default player UI must not present Product Gate copy as guidance.

3. Keep zh-CN/en readable and testable.
   - Add or adjust localization keys instead of hardcoded player copy.
   - Extend unit/e2e expectations so both locales expose first-play guidance
     and the default UI excludes diagnostics harness copy.

4. Record copy and cultural terminology boundaries.
   - Document that this is controlled-test / demo-only guidance, not final or
     public-release copy.
   - Preserve fictional terminology boundaries for Chronicle, lamp network,
     town ordinances, obligations and anomalies.

5. Produce reviewer evidence.
   - Update `coordination/reports/WM-0119.md` with acceptance mapping and check
     results.
   - Run the required task checks before `taskctl complete`.

## Provisional Canon And Balance Values

- Provisional canon: "First-play guidance" is a shell-level player guidance
  layer for M8 controlled testing. It does not add authoritative simulation
  behavior.
- Provisional balance: guidance priority is derived from visible read-model
  alerts and existing task/resident state only. No new tuning values or content
  balance numbers are introduced.
