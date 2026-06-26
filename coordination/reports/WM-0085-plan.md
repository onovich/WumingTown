# WM-0085 - Create M6 Execution Packets And Baseline Audit

## Goal

Instantiate the reviewed M6 Web / Windows Product Gate task DAG as concrete task
JSON and record the clean startup audit, without starting product
implementation.

## Read Context

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `coordination/roles.json`
- `coordination/project-state.json`
- `coordination/thread-registry.json`
- all existing `coordination/tasks/*.json`
- `coordination/reports/WM-0083.md`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `docs/00_project/05_decision_register.md`
- `docs/05_tech/*`
- `docs/06_engineering/*`
- `docs/07_roadmap/*`
- `docs/08_codex/*`
- `coordination/decisions/ADR-0001.md` through `ADR-0010.md`
- `PLANS.md`

## Non-Goals

- No Web, Windows, Electron, storage, Worker, UI, accessibility, benchmark or
  diagnostic implementation in WM-0085.
- No product runtime, simulation, content data, test behavior, package
  manifest, lockfile or benchmark artifact edits.
- No downstream M6 task claim before WM-0085 is reviewed, integrated and done.
- No M7 task creation, promotion, claim, implementation or review.

## Current Facts And Assumptions

- The current repository roadmap is authoritative.
- Old inferred M6/M7/M8/M9 structures are deprecated.
- M6 is Web / Windows Product Gate.
- M7 is Early Access / public playtest preparation.
- M8 is 1.0.
- M5 closed through WM-0083 with final world/read-model hashes
  `0xfba70a5c` / `0x9ba83cb7`.
- WM-0084 is done and reviewer verified the recovered M6 prompt and reviewed
  M6 task DAG.
- At startup, `main` and `origin/main` matched
  `c1d0be92a1ac877b6b2f0acba1390d6ec54dbf80`.
- Startup task state was 84 `done`, unread inbox 0 and no WM-0085+ task JSON.
- Startup worktree was clean and only one main worktree was registered.

## Approach

1. Create WM-0085 as the first M6 task and claim it as project-director.
2. Translate the reviewed DAG into concrete task JSON for WM-0086 through
   WM-0097.
3. Preserve the reviewed dependency intent:
   - Web branch: WM-0086 -> WM-0087/WM-0088/WM-0089.
   - Windows branch: WM-0090 -> WM-0091.
   - Cross-cutting branch: WM-0092 and WM-0093.
   - Product evidence branch: WM-0094 and WM-0095.
   - Decision and closeout branch: WM-0096 -> WM-0097.
4. Keep downstream packets `proposed` until taskctl promotion after WM-0085 is
   verified and closed.
5. Run the required checks and complete to independent reviewer.

## Risks

- A packet could accidentally reintroduce old M6/M7/M8/M9 roadmap inference.
- A packet could omit owner gates for Web cancellation, public release,
  security, save compatibility or benchmark threshold changes.
- Taskctl promotion after WM-0085 done will make the first implementation
  batch executable; this is acceptable only after independent review confirms
  the packets are correct.

## Implementation Steps

1. Add WM-0086 through WM-0097 task JSON.
2. Run `taskctl validate` and inspect task status.
3. Write WM-0085 report with audit evidence and packet summary.
4. Run required checks:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. Complete WM-0085 to reviewer.

## Tests And Benchmarks

WM-0085 has no runtime behavior. Startup gates already passed:

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `pnpm quality`
- `pnpm ci:local` with `WM_ARTIFACT_DIR` pointed to a temp directory

Final WM-0085 checks will rerun the task-required subset after files are added.

## Rollback

Revert `coordination/tasks/WM-0085.json`, newly added WM-0086 through WM-0097
task packets and `coordination/reports/WM-0085*.md`. Keep WM-0084 prompt and
DAG intact.

## Done Conditions

- WM-0086 through WM-0097 exist as concrete M6 task packets.
- Packets preserve M6 as Web / Windows Product Gate and do not start M7.
- Packets preserve M0-M5 regression gates and M5 final hashes.
- Downstream packets are proposed before WM-0085 review.
- Required WM-0085 checks pass.
