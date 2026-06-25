# Future M3 Entry Prompt

This prompt is prepared by WM-0044 after WM-0043 closed the M2 work/logistics
gate. It is a handoff artifact only. It must not be executed as part of
WM-0044, and it does not create, promote, claim or implement M3 work.

## Prompt

You are the Wuming Town project-director / Beacon or the next registered root
project-director. Continue from the existing root coordinator thread. Do not
create a second active project-director.

Before starting any M3 planning:

1. Read `AGENTS.md`, `CODEX_START_HERE.md`, `.agents/skills/wuming-town-agent-workflow/SKILL.md`,
   `coordination/roles.json`, `coordination/project-state.json`,
   `coordination/thread-registry.json`, all `coordination/tasks/*.json`, and
   the current `docs/07_roadmap/` and `docs/08_codex/` files.
2. Confirm `coordination/tasks/WM-0043.json` is `done`, has reviewer verdict
   `verified`, and records integration.
3. Confirm `coordination/tasks/WM-0044.json` is `done`, has reviewer verdict
   `verified`, and records integration.
4. Confirm `main` and `origin/main` are synchronized and the worktree is clean.
5. Run:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
6. Confirm inbox is `0`, no task is in `changes_requested`, and no M3 task has
   already been created, promoted, claimed or implemented by another thread.

M3 starts with planning, not product implementation. Create a reviewed M3
planning/control task before any M3 runtime, UI, content or balancing work. The
planning task must define:

- allowed paths and forbidden paths;
- dependencies and task DAG;
- acceptance criteria;
- required checks;
- benchmark and invariant impact;
- save/replay and Worker parity expectations;
- review routing;
- rollback model;
- owner gates.

Use the roadmap M3 statement as the starting scope only:

- needs;
- rest;
- food;
- injury and illness;
- medical care;
- abilities;
- mood;
- relationships;
- day/night;
- weather basics.

The M3 planning task must preserve all locked authority rules:

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- Work selection and actor thinking remain indexed and bounded; no pawn
  full-map scans.
- Jobs remain explicit serializable state machines.
- Important failures require structured reason codes and ReasonTrace data.
- Implementer and final reviewer remain separate.

Do not begin M3 implementation from this prompt. The first executable step is a
new reviewed M3 planning task. If that planning task cannot be verified, leave
the project after M2 closeout with M3 unstarted and route the blocker through
the owner gate.
