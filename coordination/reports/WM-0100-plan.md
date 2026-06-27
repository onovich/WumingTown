# WM-0100 Execution Plan

## Scope

WM-0100 records the M7 early-game balance and readability pass from existing M5
alpha content evidence and M6 product-gate constraints. The implementation is a
documentation/evidence package only; it must not change content data,
simulation code, save/replay behavior, benchmark baselines or product-gate
verdicts.

## Source Audit Notes

The task packet references `docs/01_design/03_player_experience.md`, but the
repository currently contains `docs/01_design/03_daily_loop_and_pacing.md` and
`docs/01_design/02_player_journey_and_story.md` instead. WM-0100 treats that as
a documentation-path mismatch, records it in the report, and uses the existing
design/M5/M6 documents as source material.

## Steps

1. Audit M5 alpha content closeout evidence, daily-loop pacing, content
   balance guides, sample catalog, performance budget and M6 closeout verdicts.
2. Draft a citable M7 balance/readability package covering resource pressure,
   night-risk cadence, event frequency, failure recovery, player understanding
   risks and downstream copy limits.
3. Preserve M5 deterministic hashes and benchmark policy by avoiding runtime or
   content-data changes.
4. Run required checks:
   - `pnpm typecheck`
   - `pnpm test --filter m5-invariants`
   - `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. Complete WM-0100 to independent review.

## Non-Goals

- No M5 hash migration, benchmark baseline update or threshold change.
- No simulation/core-system rewrite.
- No content-volume expansion or M8 content.
- No UI implementation, platform save/Worker protocol change, telemetry,
  accounts, hosted services, release, store, signing, installer or updater
  work.
