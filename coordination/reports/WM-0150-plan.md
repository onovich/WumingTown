# WM-0150 Execution plan

## Scope

Implement the first authoritative headless/Simulation Worker command-to-job
slice for reviewed lamp-priority and simple-build commands. Keep authority in
Worker/headless sim code and expose read-only command, job, pawn, progress and
blocked-reason evidence for later UI projection.

## Inputs read

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0150.json`
- `coordination/reports/WM-0149.md`
- `coordination/decisions/ADR-0012.md`
- `docs/05_tech/02_worker_protocol.md`
- `docs/02_systems/03_map_space_rooms_lanterns.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/06_engineering/03_definition_of_done.md`
- Relevant `sim-protocol`, `sim-core`, `sim-worker`, `testkit` and headless
  runner files.

## Steps

1. Extend `sim-protocol` with schema-v2 playable command/result types and
   validation for `PrioritizeLampWork` and `QueueSimpleBuild`, preserving
   existing deterministic Noop advance commands for already-reviewed scenario
   parity tests.
2. Add a focused sim-core playable runtime with explicit serializable order,
   job and pawn state; stable read-model hashes; structured blocked reasons;
   deterministic replay evidence; and performance counters.
3. Reuse existing `BuildSiteStore` and `JobCoreStore` for the simple-build
   progress/completion path, while keeping lamp-priority state explicit and
   bounded.
4. Wire the new runtime into Simulation Worker/headless catalog selection and
   return reliable per-command results plus read-only projection summaries.
5. Add deterministic tests covering accepted command to marker/read-model,
   pawn claim, movement, working, completion and structured failure/rejection
   cases.
6. Run all required checks and record exact results in
   `coordination/reports/WM-0150.md`, then run `taskctl complete`.

## Constraints

- No React, Pixi, Electron or UI authority changes.
- No sim-core DOM, React, Pixi, Electron, Node filesystem, real-time clock or
  ambient randomness.
- No full-world scans from pawn thinking; candidate work is fixed and indexed
  for this slice with bounded counters.
- No public save compatibility promise. Replay evidence is focused and
  deterministic for this slice only.
