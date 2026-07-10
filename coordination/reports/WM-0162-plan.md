# WM-0162 Execution Plan

## Objective

Define the PR-1 integrated `GameSession` architecture, migration/rollback plan,
asset inventory, measurable exit gates and a proposed implementation DAG
without implementing runtime code or changing public protocol/schema/save
formats.

## Plan

1. Claim WM-0162 as `systems-architect` and read all required docs/source.
2. Inventory reusable M0-M8 stores, scenario runners, Worker modes, projections
   and save surfaces.
3. Write ADR-0017 for the authoritative integrated session decision.
4. Write `docs/05_tech/12_integrated_gamesession_architecture.md` with the
   detailed inventory, lifecycle, scheduling, projection/save boundaries and
   PR-1 exit gates.
5. Create proposed WM-0163..WM-0166 task packets only; keep them unclaimed and
   unpromoted.
6. Write the WM-0162 report and run required checks.
7. Inspect diff, commit the task branch and request review.

## Scope Guards

- No `apps/**` or `packages/**` implementation files are edited by WM-0162.
- No public protocol, schema, save format or product UI implementation is
  changed by WM-0162.
- PR-1 implementation tasks remain `proposed` and depend on WM-0162 or later
  PR-1 tasks.
- No PR-2+ task packets are created.

## Candidate DAG

`WM-0162 -> WM-0163 -> { WM-0164, WM-0165 } -> WM-0166`

This gives one sim-core critical-path task, two parallel integration tasks
(Worker and Web route), and one independent gate task. Concurrent write-heavy
width is two, below the cap of three.
