# WM-0162 Execution Plan

## Objective

Define the PR-1 integrated `GameSession` architecture, migration/rollback plan,
asset inventory, measurable exit gates and a proposed implementation DAG
without implementing runtime code or changing protocol/schema/save files.
The plan may approve a bounded future protocol change for a proposed dependent
task.

## Plan

1. Claim WM-0162 as `systems-architect` and read all required docs/source.
2. Inventory reusable M0-M8 stores, scenario runners, Worker modes, projections
   and save surfaces.
3. Write ADR-0017 for the authoritative integrated session decision.
4. Write `docs/05_tech/12_integrated_gamesession_architecture.md` with the
   detailed inventory, lifecycle, scheduling, projection/save boundaries and
   PR-1 exit gates.
5. Resolve reviewer MSG-MREN53JS-7E9ED9 by approving a minimal versioned
   GameSession projection protocol, assigning one protocol file owner and
   defining compatibility/failure-closure behavior.
6. Create and refine proposed WM-0163..WM-0166 task packets only; keep them
   unclaimed and unpromoted on one executable serial critical path.
7. Write the WM-0162 report and run required checks.
8. Inspect diff, commit the task branch and request review.

## Scope Guards

- No `apps/**` or `packages/**` implementation files are edited by WM-0162.
- No protocol, schema, save format or product UI implementation file is changed
  by WM-0162. ADR-0017 approves only the schema-v3 projection work assigned to
  proposed WM-0164.
- PR-1 implementation tasks remain `proposed` and depend on WM-0162 or later
  PR-1 tasks.
- No PR-2+ task packets are created.

## Candidate DAG

`WM-0162 -> WM-0163 -> WM-0164 -> WM-0165 -> WM-0166`

This gives one sim-core runtime producer, one sole protocol/Worker producer,
one Web consumer and one independent gate task in executable dependency order.
Concurrent write-heavy width is one. WM-0164 exclusively owns the exact
`packages/sim-protocol` projection files and tests listed by ADR-0017; all other
tasks consume the package public root.
