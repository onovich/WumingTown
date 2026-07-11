---
name: wuming-town-agent-workflow
description: Coordinate Wuming Town Codex work: claim repository tasks, enforce plans/tests/reviews, send completion or blocker messages to named agent-role inboxes, route inbox messages to active subagents, and close verified work. Use for every project task, handoff, review, or multi-agent dispatch; do not use for casual discussion outside this repository.
---

# Wuming Town Agent Workflow

Operate from the repository root. Treat `coordination/tasks` and `coordination/inbox` as the durable control plane; chat memory is not authoritative.

## Before doing work

1. Read `AGENTS.md` and the task's `docs` paths.
2. Run:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status
```

3. Do not start a blocked task. Do not claim work owned by another live agent.
4. For complex tasks, create an execution plan using `PLANS.md` before editing product code.

## Worker mode

Claim the task:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs claim \
  --id WM-0000 --agent simulation-engineer --thread "Tally"
```

Work only in the task's branch/worktree. Keep scope within acceptance criteria. Run every required check. Write `coordination/reports/<TASK>.md` using `assets/report-template.md`.

Complete and notify the designated reviewer:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs complete \
  --id WM-0000 --agent simulation-engineer \
  --summary "Implemented ...; all required checks pass"
```

`complete` must not mark the task done. It moves the task to `review_requested` and creates a durable message in the reviewer's inbox.

If blocked:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs block \
  --id WM-0000 --agent simulation-engineer --to systems-architect \
  --reason "Public protocol decision required: ..."
```

Never hide a blocker by adding a local workaround that violates architecture.

## Reviewer mode

Read the task, report, branch diff, relevant specs and required check output. Do not edit code in the read-only reviewer role.

Request changes:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs review \
  --id WM-0000 --agent reviewer --verdict changes_requested \
  --summary "High: ...; Medium: ..."
```

Verify:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs review \
  --id WM-0000 --agent reviewer --verdict verified \
  --summary "No blocking findings; acceptance evidence confirmed"
```

A review command sends a follow-up message to the task owner.

## Director/orchestrator mode

1. Run `taskctl route` and inspect every unacknowledged message.
2. For each message, route the body and file paths to the named active Codex subagent. Codex parent threads can steer running subagents; explicitly ask Codex to send the follow-up.
3. If the target role has no active agent, spawn the project custom agent from `.codex/agents/` and provide the task/message paths.
4. When a concrete thread identifier is available, register it with `taskctl register-thread`; `taskctl route` will then print an exact target.
5. Acknowledge only after routing:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs ack \
  --role reviewer --message MSG-...
```

6. Spawn only unblocked tasks. Keep no more than three write-heavy tasks active simultaneously.
7. After `verified`, the integration role rebases/runs the full gate, then:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs integrate \
  --id WM-0000 --agent project-director --summary "Merged commit ...; full gate passed"
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs done \
  --id WM-0000 --agent project-director
```

## Spark dispatch classifier

Before dispatching a task, project-director may route it to `rapid-implementer` only when all of these are true:

A. The task has an approved spec or interface.
B. It touches only one local module, one package, or one tightly bounded feature slice.
C. The task packet lists allowed paths and forbidden paths.
D. Complete automated acceptance exists.
E. The work does not touch architecture, save formats, public or Worker protocols, Schema, concurrency ownership, security boundaries, locked decisions, ADR final decisions, new runtime dependencies, or high-risk deterministic simulation design.
F. The expected diff fits the default Spark limit: no more than 8 modified files and about 300 net changed lines.
G. The work does not depend on image understanding, screenshot interpretation, or visual taste.

If any critical condition is false, do not assign the task to Spark to save model quota. Use the original owner role or split the task.

Spark write work must have its own coordination task, or a clearly auditable child task with branch/worktree and file ownership. Messages may use `to: rapid-implementer`; `taskctl route` discovers this role through `coordination/roles.json`. If no active Spark thread exists, project-director may spawn `.codex/agents/rapid-implementer.toml`, register the returned thread id, and ack only after the message is truly delivered.

Spark completion still goes to the task's `reviewerRole`. `reviewer` must not use Spark as the final review model.

If Spark is unavailable, queued, or not accessible in the current account/session, do not pretend it was used. Record `rapid-implementer unavailable` in the task report, then explicitly fall back to `gpt-5.4-mini` or reassign to the original owner role. Record the actual model and reason.

## Communication rules

- Messages contain summaries and repository paths, not giant logs or secrets.
- File inbox is the reliable fallback; do not assume arbitrary standalone Codex app threads have a stable public messaging API.
- A completion message is not approval. A verified review is not integration. A merged branch is not done until task state is closed.
- If the same workflow failure happens twice, update this skill, a reference, or `AGENTS.md`. For repeated per-task lock failures, follow the approval-gated abandoned-lock procedure in `references/protocol.md`; never add automatic lock eviction or delete a lock on the first failure.

## References

Read only when needed:

- `references/protocol.md`
- `references/task-schema.md`
- `references/quality-gates.md`
- `references/codex-routing.md`
- `references/native-thread-routing.md`
- `references/native-thread-routing.md`
