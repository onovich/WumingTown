# WM-0011 - Integrate and close Milestone M0

## Scope

Close the M0 engineering foundation by making the final gate executable from the root, documenting current M0 limits, recording residual risk, and producing a reviewable closeout report. This task does not add gameplay simulation, map systems, jobs, reservations, pathing, save containers, or new product direction.

## Inputs

- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/06_engineering/03_definition_of_done.md`
- `coordination/tasks/WM-0011.json`
- Prior verified M0 task reports: `coordination/reports/WM-0003.md`, `WM-0004.md`, `WM-0005.md`, `WM-0006.md`, `WM-0009.md`, `WM-0010.md`

## Steps

1. Claim WM-0011 on `task/WM-0011-integrate-m0`.
2. Add the missing root `build:web` command required by the task gate.
3. Document M0 closeout boundaries and known limitations so placeholders are not represented as completed gameplay.
4. Run the complete M0 gate from a clean task branch.
5. Write `coordination/reports/WM-0011.md`.
6. Complete the task and request independent reviewer verification.

## Non-goals

- No product implementation.
- No schema, public Worker protocol, save format, or ADR final-decision change.
- No Spark dispatch; this is a project-director closeout and integration task.
