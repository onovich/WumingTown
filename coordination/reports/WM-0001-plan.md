# WM-0001 - Validate and adopt the handoff control plane

## Objective
Adopt the Wuming Town handoff package as the repository control plane, verify the durable coordination workflow, and produce a first M0 execution order without changing locked product decisions.

## Read Context
- `AGENTS.md`
- `CODEX_START_HERE.md`
- `README.md`
- `HANDOFF_FILE_INDEX.md`
- `PLANS.md`
- `docs/00_project/00_executive_summary.md`
- `docs/00_project/01_product_charter.md`
- `docs/00_project/02_scope_and_non_goals.md`
- `docs/00_project/05_decision_register.md`
- `docs/00_project/06_risks_and_assumptions.md`
- `docs/01_design/00_game_design_overview.md`
- `docs/01_design/01_game_program_design.md`
- `docs/01_design/07_system_interaction_matrix.md`
- `docs/05_tech/00_tech_stack.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/06_engineering/00_coding_standard.md`
- `docs/06_engineering/01_performance_constitution.md`
- `docs/06_engineering/02_workflow.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/07_roadmap/02_first_90_days.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `docs/08_codex/01_model_assignment.md`
- `docs/08_codex/02_thread_communication_protocol.md`
- `docs/08_codex/03_task_state_machine.md`
- `docs/08_codex/04_automation_skill_install.md`
- `docs/08_codex/05_human_approval_gates.md`
- `coordination/roles.json`
- `coordination/project-state.json`
- `coordination/tasks/WM-0001.json`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.agents/skills/wuming-town-agent-workflow/references/protocol.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `.agents/skills/wuming-town-agent-workflow/references/quality-gates.md`
- `.agents/skills/wuming-town-agent-workflow/references/codex-routing.md`
- `.agents/skills/wuming-town-agent-workflow/references/native-thread-routing.md`

## Non-goals
- Do not implement gameplay, UI, simulation, content, or build-system features.
- Do not change any locked product decision, platform target, engine choice, simulation-thread model, or M0 task dependency.
- Do not spawn all nine roles or start downstream M0 implementation tasks.
- Do not copy the repository-local skill into a global skill location unless repo-local loading is proven unavailable and needed.

## Current Facts And Assumptions
- The workspace began with only the original handoff ZIP and SHA-256 file in `docs/`.
- The original directory was not yet a Git repository, so a baseline `main` commit was created before adopting the expanded handoff content.
- The WM-0001 branch is `task/WM-0001-adopt-control-plane`, matching the task file.
- The repo-local skill exists and has no UTF-8 BOM in `SKILL.md` or `agents/openai.yaml`.
- The current Codex session did not list `$wuming-town-agent-workflow` as a formally discovered skill at startup, so this task follows the skill by direct repository read.

## Approach
1. Verify the original ZIP hash against `docs/WumingTown_Handoff_2026-06-23.zip.sha256`.
2. Extract the ZIP to a temporary directory and confirm its outer directory is `WumingTown_Handoff_2026-06-23/`.
3. Copy the outer directory contents into the repository root while preserving the original ZIP and SHA-256 file in `docs/`.
4. Initialize Git safely because the workspace had no `.git`, add the required remote, create the WM-0001 task branch, and leave history unrewritten.
5. Read the required handoff corpus, project skill, role definitions, task queue, manifest, checksums, and Codex agent TOML files.
6. Run the required validation commands and record exact outcomes.
7. Record discovered contradictions, intentional design notes, open items, risks, M0 scheduling order, and human approval gates.
8. Complete WM-0001 through `taskctl complete`, request independent reviewer verification, and only then integrate and close if reviewer verdict is `verified`.

## Risks
- `CHECKSUMS.sha256` is a handoff baseline; task workflow commands intentionally mutate coordination JSON and can invalidate those baseline hashes after adoption begins.
- The current Codex session may need a reload before the repo-local skill appears in the UI picker or explicit `$wuming-town-agent-workflow` autocomplete.
- Native custom-agent TOML spawning may not be exposed directly by the current tool surface; if so, a reviewer subagent must be spawned with the reviewer instructions and registered by its returned agent id.
- Downstream M0 work must not begin until WM-0001 is independently reviewed.

## Steps
1. Establish and record repository, branch, remote, and baseline commit state.
2. Verify ZIP SHA-256 and extraction layout.
3. Verify handoff structure and task coordination files.
4. Verify 9 role definitions across `.codex/agents/*.toml` and `coordination/roles.json`.
5. Run:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
6. Write `coordination/reports/WM-0001.md`.
7. Run `taskctl complete`, route the review request to a reviewer, and wait for reviewer verdict.

## Tests And Validation
- Required validation commands listed above.
- Explicit SHA-256 comparison for the original ZIP.
- Checksum baseline inspection for `CHECKSUMS.sha256`.
- Git status, branch, history, and remote inspection.
- Role and task queue inspection.

## Rollback
Because the repository began without Git history, rollback before final integration is by abandoning the task branch and returning to the initial `main` baseline commit containing only the original ZIP and SHA-256. Do not delete the original handoff files.

## Completion Conditions
- Handoff validator passes.
- `taskctl validate` passes.
- `taskctl status` is recorded.
- WM-0001 report lists contradictions or states none were found.
- M0 execution order keeps no more than three concurrent write-heavy tasks.
- No locked decision is changed.
