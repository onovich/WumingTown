# WM-0169 Execution Plan

## Objective

Define the reviewed PR-2 autonomous-town architecture and a finite executable
implementation DAG without changing product code. Rebaseline project truth
after the completed PR-1 GameSession, reconcile the historical WM-0154 blocker,
and lock only the minimum future projection/speed decision required for eight
residents to live visibly through one full game day.

## Inputs read

- `AGENTS.md` and `wuming-town-agent-workflow`.
- The playable-product recovery roadmap, especially PR-2, evidence policy and
  task-running model.
- WM-0162 architecture/plan/report and ADR-0017.
- WM-0166, WM-0167 and WM-0168 task packets, plans, reports and reviewed exit
  evidence.
- The integrated GameSession architecture and AI/Job/Reservation/pathing system
  contract.
- Current GameSession projection, Worker speed and Web/Pixi read-model surfaces.

## Plan

1. Claim WM-0169 on its ordinary task branch and preserve one worktree.
2. Record post-PR-1 truth in `coordination/project-state.json` without claiming
   PR-2 autonomy, playability, save or release readiness.
3. Write `docs/05_tech/13_autonomous_town_life_architecture.md` covering owner
   stores, eight-resident/full-day behavior, explicit states and reasons,
   bounded decision/path/reservation flow, Worker speeds, presentation,
   performance and three-line evidence.
4. Record ADR-0018 because schema-3 projection v1 and the current 0/1/2/3
   multiplier contract cannot losslessly satisfy the PR-2 route/reason/4x
   gates. Approve only a future schema-4 projection-v2 implementation owned by
   WM-0172; do not modify protocol files in this task.
5. Reconcile only WM-0154's stale blocker text. Keep WM-0154 blocked and leave
   WM-0155/WM-0156 proposed and unchanged.
6. Create and refine proposed/unclaimed WM-0170..WM-0175 in a strict serial
   DAG: core decision contract, full-day integration, sole projection/Worker
   migration, Web/Pixi/HUD consumption, automated integration evidence, then
   independent product acceptance.
7. Run required checks plus JSON, DAG, dependency-path, state and scope audits;
   write the completion report and inspect the diff.
8. Commit planning files, then use `taskctl complete` to request independent
   review. Do not integrate, merge, push, promote or claim implementation work.

## Scope guards

- No `apps/**`, `packages/**` or `tools/**` implementation file changes.
- No protocol, schema, projection, save-format or public command implementation.
- ADR-0018 is a proposed locked plan for WM-0172, not an implementation.
- No PR-3 command, priority, selection or building task is created.
- WM-0170..WM-0175 stay `proposed`, without `claimedBy`, review or integration.
- Maximum concurrent write-heavy width is one, below the repository limit of
  three; each required-check path exists already or belongs to that task/an
  ancestor.

## Candidate DAG

```text
WM-0169 planning
  -> WM-0170 autonomy state + indexed selection
    -> WM-0171 full-day jobs + GameSession integration
      -> WM-0172 schema-4 projection v2 + Worker 1x/2x/4x
        -> WM-0173 Web/Pixi interpolation + focused HUD
          -> WM-0174 integrated automated/continuous evidence
            -> WM-0175 independent product acceptance
```

Every edge is a hard dependency. No branch writes concurrently, and the sole
future `sim-protocol` writer is WM-0172.
