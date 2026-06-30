# WM-0149 Execution Plan

## Scope

Design only. This task will not modify product implementation code, runtime
protocol code, Worker code, sim-core behavior, UI code, save code or build
configuration. Changes stay within WM-0149 allowed documentation/control-plane
paths.

## Required Context

1. Read WM-0145 and WM-0146 reports plus the post-M8 playable-product
   acceptance reset.
2. Inspect existing `sim-protocol`, `sim-worker`, `job-core` and `build-site`
   surfaces to align the proposed contract with current authority boundaries.
3. Read technical, engineering and ADR documents for Worker authority,
   determinism, persistence, protocol versioning, performance and review gates.

## Design Work

1. Author a protocol/architecture document or ADR for the first playable
   lamp-priority/simple-build vertical slice.
2. Specify command payloads, result payloads, rejection reasons and read-model
   projection requirements.
3. Preserve Simulation Worker authority: React, Pixi and Electron may send
   commands and consume projections only; they must not mutate world state.
4. Record save, replay, determinism, schema and versioning implications,
   including implementation prerequisites and whether ADR/migration is needed.
5. Define structured blocked reasons for missing resource, no path, no worker,
   invalid target, stale command and rule/policy denial.

## Validation

Run the required checks before completion:

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`

## Handoff

Write `coordination/reports/WM-0149.md`, then run `taskctl complete` for
reviewer handoff. Completion requests review only; it does not mark the task
done.
