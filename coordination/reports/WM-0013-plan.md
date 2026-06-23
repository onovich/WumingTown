# WM-0013 - Add the Codex Spark rapid implementation lane

## Objective
Add a bounded `gpt-5.3-codex-spark` rapid implementation lane to the project control plane without changing product direction, existing core role assignments, thread limits, write-task limits, or original handoff source records.

## Read Context
- `OWNER-AMENDMENT-2026-06-23-SPARK-LANE`
- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `docs/08_codex/01_model_assignment.md`
- `docs/08_codex/02_thread_communication_protocol.md`
- `docs/08_codex/06_bootstrap_prompts.md`
- `coordination/roles.json`
- `.codex/config.toml`
- OpenAI official sources listed in `docs/08_codex/08_spark_execution_lane.md`

## Non-goals
- Do not reinitialize the repository or re-extract the handoff archive.
- Do not modify `docs/WumingTown_Handoff_2026-06-23.zip`, its `.sha256`, `HANDOFF_MANIFEST.json`, or `CHECKSUMS.sha256`.
- Do not change product direction, technical architecture, Roadmap scope, existing task dependencies, max thread count, or max write-task count.
- Do not assign Spark to architecture, final review, protocol, save, Schema, security, determinism, or high-risk simulation work.

## Current Facts And Assumptions
- WM-0001 is `done`; WM-0002 is `ready`.
- The current branch for this work is `task/WM-0013-add-spark-execution-lane`.
- The project currently has 9 original handoff roles plus the new operational `rapid-implementer` role after this amendment.
- Current session supports spawning subagents and model override, but does not expose a direct "load this `.codex/agents/*.toml` custom agent" button. Smoke validation will therefore launch a no-product-change subagent with the same model and instructions, then register and close it.

## Approach
1. Create WM-0013 as an auditable task and claim it through taskctl.
2. Add `.codex/agents/rapid-implementer.toml`.
3. Add `rapid-implementer` to `coordination/roles.json` and create its inbox.
4. Add `docs/08_codex/08_spark_execution_lane.md` and update related multi-agent docs plus `AGENTS.md`.
5. Add Spark dispatch classifier and fallback rules to the repo-local workflow Skill.
6. Run a smoke subagent with `gpt-5.3-codex-spark` and no product writes if the current tool surface can spawn it.
7. Run validators, `git diff --check`, JSON/TOML/config checks, and original source file diff checks.
8. Request independent reviewer verification before integration/done.

## Risks
- Current Codex UI may require a project session reload before the new `.codex/agents/rapid-implementer.toml` appears in a picker.
- `tools/validate-handoff.mjs` reports current operational role count; this should become 10 while the original handoff manifest remains 9.
- `CHECKSUMS.sha256` records the original handoff snapshot and should not be edited to match mutable control-plane files.

## Implementation Steps
1. Update task/control-plane files.
2. Update agent TOML and inbox.
3. Update documentation and Skill routing.
4. Perform smoke thread creation with no product modification.
5. Run all required validation.
6. Write final report and send to reviewer.

## Tests And Validation
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- JSON parse of `coordination/roles.json`
- TOML/config text inspection for rapid agent, max threads, and max depth
- Git diff checks proving protected handoff source files are unchanged

## Rollback
Revert the WM-0013 branch commits. Do not touch pushed WM-0001 history or original handoff archive files.

## Completion Conditions
All WM-0013 acceptance criteria pass, reviewer returns `verified`, project-director integrates and closes the task, and the task branch is pushed.
