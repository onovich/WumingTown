# WM-0007 Execution plan

## Scope
- Worktree: `D:\WebProjects\WumingTown-WM-0007`
- Branch: `task/WM-0007-entity-stores`
- Role/thread: `simulation-engineer` / `Tally`
- Spark: not used
- Subagents: not used

## Required contracts
- Add `EntityId` handles with `index` and `generation`.
- Validate cross-tick references by matching live slot generation.
- Increment generation when a live slot is destroyed so stale handles cannot alias a reused slot.
- Keep component stores bounded by explicit capacity, with stable ascending index iteration.
- Defer allocation, destruction, attach, detach, and write operations through an explicit structural command buffer commit phase.
- Resolve command conflicts deterministically by command priority, then entity index, then insertion sequence; expose structured per-command results.

## Implementation steps
1. Add focused `sim-core` modules for entity registry, bounded numeric component store, and structural command buffer.
2. Export public APIs from `packages/sim-core/src/index.ts` without deep-import requirements.
3. Add invariant/property-style unit tests for allocation, destruction, slot reuse, generation validation, capacity boundaries, stable iteration, and deferred commit semantics.
4. Add a literal `entity-store` target to `tools/test-runner.mjs` and `packages/benchmarks` so the required filtered commands run.
5. Run the required checks and write `coordination/reports/WM-0007.md`.

## Verification plan
- `pnpm typecheck`
- `pnpm test --filter entity-store`
- `pnpm bench --filter entity-store`
- `pnpm lint`
- `pnpm content:validate`
- `pnpm boundaries:check`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`

## Out of scope
- WM-0008 RNG streams, world hashing, replay divergence diagnostics.
- Jobs, reservations, pathing, gameplay systems, UI, Electron, content compiler, save format, and persistence.
- `taskctl complete`; project-director will run completion after owner review.
