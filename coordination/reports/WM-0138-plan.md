# WM-0138 Plan

## Scope

Deliver one minimum playable interaction chain in the Web player shell:
select a lamp-relevant target, issue a meaningful HUD action, record a
traceable result, and show localized feedback. The implementation must not fake
Simulation Worker authority or claim final gameplay balance.

## Baseline Read

- WM-0130 identifies the blocker: current command surface is placeholder-only,
  and the public protocol only supports `Noop` and `Echo`.
- WM-0136 proves selectable residents/objects, including a lamp-relevant
  `lantern-keeper` entity and structure selection.
- WM-0137 proves map input/camera controls no longer block selection.
- `packages/sim-protocol` does not currently expose a meaningful lamp-priority
  command kind, so a public protocol expansion would need separate architecture
  review.

## Planned Changes

1. Add a documented shell-local command state for one action:
   `prioritize-lamp-work`.
2. Wire the primary HUD command button to a Web local adapter when a
   lamp-relevant entity is selected.
3. Record traceable non-authoritative state:
   command id, target entity id, adapter id, reason code, consequence class and
   follow-up note.
4. Render localized feedback and structured reason evidence in the HUD.
5. Add E2E coverage for the full chain in `en` and `zh-CN`.

## Verification Plan

- Focused UI tests for command feedback/localization.
- Focused Web E2E for select -> command -> feedback in `en` and `zh-CN`.
- Full `node tools/test-runner.mjs e2e --filter web-shell`.
- Required task checks, with the known unsupported `corepack pnpm test --filter
web-shell` command shape recorded if it still maps to unit mode.
