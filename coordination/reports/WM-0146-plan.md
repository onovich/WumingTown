# WM-0146 Execution Plan

## Goal

Produce the post-M8 playable-product acceptance reset for the first five
minutes of Wuming Town. The result is a design/control-plane artifact only: no
product implementation, platform verdict, release gate, Worker protocol, save
schema, telemetry, account, signing, store, paid-service or public-save action
is in scope.

## Context

Owner feedback and the art-thread review both identify the current surface as
a hard product blocker. The player cannot tell what to do, what to watch, how
to build, how to direct people, or whether residents are acting. WM-0138's
lamp-priority chain is useful evidence, but it remains a shell-local adapter
and is not enough for a colony-sim product bar.

## Scope

1. Record the product blocker without minimizing it as polish.
2. Define a 2-3 minute dusk lamp/simple-build playable slice.
3. Make player-perceptible NPC action a hard gate.
4. Define first-screen information hierarchy for the default player HUD.
5. Preserve all Web demo-only, Windows controlled-test and public release
   owner gates.

## Deliverables

- `docs/01_design/12_post_m8_playable_product_acceptance.md`
- `coordination/reports/WM-0146.md`
- WM-0146 task packet update to include the new design doc.

## Verification

Run the required checks:

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`

## Fallback Note

The originally routed gameplay-designer thread did not claim the task because
it requested unavailable escalation. A fresh gameplay-designer subagent also
left no file-system changes before being stopped. Beacon is executing the
gameplay-designer drafting work as a documented fallback; final review remains
assigned to an independent reviewer.
