# WM-0021 Execution Plan

Agent: simulation-engineer / Tally

## Scope

- Work only in `D:\WebProjects\WumingTown-WM-0021` on branch
  `task/WM-0021-implement-incremental-region-room-rebuild-and-na`.
- Keep `sim-core` free of DOM, React, Pixi, Electron, Node filesystem, real
  time and ambient randomness.
- Do not add path request queues, path search, gameplay jobs, WorkOffer logic,
  reservation semantics, UI overlays or save container finalization.

## Implementation Steps

1. Extend `MapGrid` with the smallest deterministic topology lanes needed for
   WM-0021: cardinal wall and closed-door masks, passability helpers, snapshot
   and hash coverage.
2. Add a `RegionRoomRebuilder` owner in `sim-core`:
   - typed dirty-cell queue and explicit active flood-fill state;
   - immediate monotonic navigation/region/room versions when topology is
     invalidated;
   - budgeted `processDirtyCells` API with processed cell/region/queue metrics;
   - structured reason codes and public snapshot/query helpers for future
     pathing basis checks.
3. Add focused `region-room` Vitest coverage for local wall removal, door
   toggles, cross-boundary movement and room consistency.
4. Add `pnpm test --filter region-room` dispatch in `tools/test-runner.mjs`.
5. Add `region-room` benchmark support with queue length, processed cells,
   drain ticks, no-sustained-growth evidence, version and hash/checksum fields,
   plus baseline parsing and baseline entry.
6. Update map/space and performance docs with concise WM-0021 notes.
7. Run required checks, write `coordination/reports/WM-0021.md`, complete the
   task only if checks pass, then commit and push.

## Expected Evidence

- `pnpm typecheck`
- `pnpm test --filter region-room`
- `pnpm bench --filter region-room`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm lint` because TypeScript and runner files are touched.
