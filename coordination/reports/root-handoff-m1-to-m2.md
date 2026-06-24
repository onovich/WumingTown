# Root Handoff M1 to M2

## Summary

This report records the root project-director handoff after WM-0030 closed M1
and before M2 planning begins. The active root thread is now Beacon:
`019efb60-ec5e-78f0-8a7c-7fb1754539cd`.

M2 product implementation has not started in this report. The approved M2 entry
prompt requires a reviewed M2 plan and task DAG before implementation branches
begin.

## Old root registration

Before this handoff thread replaced the route, the durable thread registry
contained:

- role: `project-director`
- threadId: `Beacon`
- label: `WM-0001 project director root`
- registeredAt: `2026-06-23T12:42:34.400Z`

That legacy entry used a label-like value rather than a UUID-shaped thread id.
The current registry schema stores one route per role and has no status,
superseded, inactive, or history array. To avoid inventing an incompatible
schema, the registry now records only the current active route and this report
preserves the replaced registration evidence.

## New root registration

- role: `project-director`
- nickname: `Beacon`
- model: `gpt-5.5`
- reasoning: `xhigh`
- threadId: `019efb60-ec5e-78f0-8a7c-7fb1754539cd`
- registry label: `Beacon`
- Role.md path: `Role.md`
- takeover branch: `task/WM-0031-record-root-handoff-from-m1-closeout-to-m2-entry`

Unique active root proof: `coordination/thread-registry.json` maps
`project-director` to one thread id only:
`019efb60-ec5e-78f0-8a7c-7fb1754539cd`.

## Baseline verification

Verified from repository and Git evidence, not chat memory:

- Repository root: `D:/WebProjects/WumingTown`
- Branch before handoff task branch: `main`
- Current handoff task branch:
  `task/WM-0031-record-root-handoff-from-m1-closeout-to-m2-entry`
- `main` HEAD before handoff: `577037ddb7bf13fddf86a55666a382ddd865b004`
- `origin/main` after fetch:
  `577037ddb7bf13fddf86a55666a382ddd865b004`
- `git merge --ff-only origin/main`: `Already up to date.`
- Origin: `git@github.com:onovich/WumingTown.git`
- Worktrees: only the repository worktree was listed before the task branch.
- Note: `origin/HEAD` points at `origin/task/WM-0001-adopt-control-plane`, but
  explicit `main` and `origin/main` checks match. This is a nonblocking remote
  default-branch hygiene issue, not an M2 blocker.

Validation before creating WM-0031:

| Command | Result |
|---|---|
| `node tools/validate-handoff.mjs` | PASS, 535 files, 30 tasks, 10 roles, digest `f88f9e4e11600c7fb66f5c76630dea38625e9bf20ce8a314119340c50e36907b` |
| `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate` | PASS, 30 tasks, 10 roles |
| `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status` | PASS, `done: 30`, unread inbox `0` |
| `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs route` | PASS, no messages require routing |
| `git diff --check` | PASS |
| `pnpm quality` | PASS, typecheck, lint, format check, content validation, boundary check and 22 unit files / 107 tests passed |

After creating WM-0031, the only non-done task is this handoff audit task.

## M0 and M1 state

Structured task verification found 30 existing tasks, WM-0001 through WM-0030,
all with:

- `state: done`
- `review.verdict: verified`
- integration evidence present

WM-0030 is done and independently verified. Its closeout report records:

- Headless hauling/building 100000 tick run passed with final world hash
  `0xf7815189`.
- Browser Worker and Node parity passed through the worker-smoke gate.
- Save/replay and M1 save-resume diagnostics passed.
- 50000 entity spatial-index pressure evidence passed with no sustained queue
  growth.
- M2 was explicitly not started by WM-0030.

## M2 entry prompt

Authoritative path:
`coordination/reports/WM-0030-m2-entry-prompt.md`

Summary:

- M2 starts with planning, not implementation.
- The first deliverable is a reviewed M2 planning task with allowed paths,
  forbidden paths, dependencies, acceptance criteria, required checks,
  benchmark impact, review routing and rollback model.
- The M2 scope is the work/logistics vertical slice:
  Region/A* integration into real work selection, bounded WorkOffer scoring for
  multiple pawns, reservation contention behavior, item storage and hauling
  beyond the M1 fixture, build orders and production-order scaffolding only as
  needed, save/replay and Worker parity, and benchmarks for 20 actors
  hauling/building plus 100 path requests under versioned invalidation.
- Excluded unless a reviewed M2 planning task admits them: broad economy,
  town-life simulation, anomaly rules, combat, content expansion, platform save
  UI and balance production.

## Skill and document read status

Read during takeover:

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `coordination/roles.json`
- `coordination/project-state.json`
- `coordination/thread-registry.json`
- `coordination/tasks/*.json`
- `coordination/reports/WM-0030.md`
- `coordination/reports/WM-0030-m2-entry-prompt.md`
- `docs/00_project/05_decision_register.md`
- `docs/05_tech/*`
- `docs/06_engineering/*`
- `docs/07_roadmap/*`
- `docs/08_codex/*`
- `coordination/decisions/ADR-0001.md` through `ADR-0006.md`
- `PLANS.md`

M2 planning should additionally read the relevant `docs/02_systems/*` files
before writing the M2 DAG.

## Owner gates for this handoff task

Required WM-0031 checks:

| Command | Result |
|---|---|
| `node tools/validate-handoff.mjs` | PASS, 538 files, 31 tasks, 10 roles |
| `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate` | PASS, 31 tasks, 10 roles |
| `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status` | PASS, `in_progress: 1`, `done: 30`, unread inbox `0` |
| `git diff --check` | PASS |
| `pnpm quality` | PASS, typecheck, lint, format check, content validation, boundary check and 22 unit files / 107 tests passed |

## Current risks

- `coordination/project-state.json` still says `phase: m1-closeout`; this is
  correct until the reviewed M2 planning task starts and updates project state.
- M2 implementation is intentionally blocked until a reviewed M2 plan and task
  DAG exists.
- The remote default `origin/HEAD` does not point to `origin/main`; explicit
  main synchronization is clean, so this is a repo hygiene follow-up rather
  than a handoff blocker.
- The previous root registry value was not a UUID thread id. This report keeps
  that evidence instead of guessing.

## Verdict

Root handoff is ready for independent review after WM-0031 owner gates pass.
M2 may proceed only to the planning task after this handoff task is verified,
integrated and pushed to `origin/main`.
