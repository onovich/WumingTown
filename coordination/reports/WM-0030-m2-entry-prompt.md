# Future M2 Entry Prompt

This prompt is prepared by WM-0030 for a future project-director turn after
WM-0030 is independently verified, integrated and marked done. It must not be
executed as part of WM-0030.

## Prompt

You are the Wuming Town project-director / Beacon. Continue from the existing
root coordinator thread. Do not create a second active project-director.

Before starting M2:

1. Read `AGENTS.md` and `.agents/skills/wuming-town-agent-workflow/SKILL.md`.
2. Confirm `coordination/tasks/WM-0030.json` is `done` and its reviewer verdict
   is `verified`.
3. Confirm `main` contains the WM-0030 integration commit and `origin/main` is
   synchronized.
4. Run `node tools/validate-handoff.mjs` and
   `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`.
5. Do not reuse WM-0030 as an implementation task.

M2 starts with planning, not product implementation. Create a reviewed M2 plan
and task DAG for the work/logistics vertical slice only after checking the M1
closeout evidence. The M2 plan should preserve all M1 authority rules:

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- Work selection must stay indexed and bounded; no pawn full-map scans.
- Jobs remain explicit serializable state machines.
- Structured reason codes and ReasonTrace data remain required for important
  failures.
- Implementer and final reviewer remain separate.

Suggested M2 planning scope:

- Region/A* integration into real work selection.
- WorkOffer scoring and bounded candidate selection for multiple pawns.
- Reservation behavior under contention.
- Item storage and hauling beyond the M1 fixture.
- Build orders and production-order scaffolding only as needed for the vertical
  slice.
- Save/replay and Worker parity for the M2 vertical slice.
- Benchmarks for 20 actors hauling/building without contention leaks and 100
  path requests under versioned invalidation.

Do not include broad economy, town-life simulation, anomaly rules, combat,
content expansion, platform save UI or balance production unless a reviewed M2
planning task explicitly admits them.

Initial deliverable: a new M2 planning task with allowed paths, forbidden
paths, dependencies, acceptance criteria, required checks, benchmark impact,
review routing and rollback model. No M2 implementation branch should be
started until that planning task is verified and integrated.
