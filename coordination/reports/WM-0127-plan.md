# WM-0127 - M8 closeout and future handoff

## Goal

Close M8 as internal 1.0 readiness evidence after all M8 tasks are reviewed,
integrated and regression gates pass, without executing public release work.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0127.json`
- `coordination/reports/WM-0110-future-m8-entry-prompt.md`
- `coordination/reports/WM-0111-m8-scope-amendment.md`
- `coordination/reports/WM-0126.md`
- `coordination/reports/WM-0128.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`
- `docs/08_codex/05_human_approval_gates.md`
- `docs/06_engineering/03_definition_of_done.md`
- M8 task JSON packets WM-0111 through WM-0128.

## Non-Goals

- Do not perform public release, 1.0 launch, Early Access launch, public Web
  launch, store submission, signing, telemetry, accounts, hosted feedback,
  crash upload, paid services or public save-compatibility commitments.
- Do not create, promote, claim, implement or review post-M8 tasks.
- Do not change product code, benchmark baselines, benchmark thresholds,
  platform verdicts, save schemas or Worker protocols.
- Do not broaden M8 beyond the reviewed 1.0 readiness evidence.

## Current Facts And Assumptions

- WM-0111 through WM-0126 and WM-0128 are `done`, independently reviewed as
  `verified` and integrated.
- WM-0128 clears the benchmark stop sign recorded by WM-0126 via current-HEAD
  benchmark evidence under the unchanged 10 percent warning / 20 percent
  blocking policy.
- Web remains `demo-only`.
- Windows remains unsigned local-directory
  `ready-for-controlled-external-test`.
- Owner approval remains required for all public release and final legal/store
  decisions.

## Approach

1. Confirm M8 task state, review and integration evidence.
2. Update the roadmap quality gate to add the final M8 closeout status.
3. Update `coordination/project-state.json` from active M8 implementation to
   closed M8 readiness / owner-gated post-M8 handoff.
4. Write the WM-0127 closeout report with readiness verdicts, validation
   matrix, technical debt, cultural/privacy/save states and owner gates.
5. Write a non-executable future handoff artifact without creating post-M8
   task packets.
6. Run the full required closeout gates, complete the task and request
   independent review.

## Risks

- Accidentally phrasing M8 as public 1.0 release approval would violate owner
  gates. The report must use internal readiness language.
- Closeout depends on long checks (`ci:local`, `bench`, quality). Any failure
  must remain a stop sign rather than be papered over.
- The project-state update must not imply Web/Windows platform verdict changes.

## Implementation Steps

1. Create this plan.
2. Draft roadmap/project-state/closeout/future-handoff docs.
3. Run required checks.
4. Update check table in the report with final command results.
5. `taskctl complete` for independent reviewer.
6. After reviewer verification, integrate, mark done, merge and push main.

## Tests And Benchmarks

- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`
- `corepack pnpm ci:local`
- `corepack pnpm test --filter m5-invariants`
- `corepack pnpm bench`
- `corepack pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`

## Rollback

Revert only WM-0127-owned documentation/control-plane edits if a closeout gate
fails. Do not weaken checks, baselines, platform verdicts or owner gates.

## Completion Conditions

- All M8 task evidence is summarized and still verified.
- Required closeout checks pass or produce a documented stop sign.
- Future handoff is non-executable and creates no post-M8 work.
- Independent reviewer verifies WM-0127 before integration and main push.
