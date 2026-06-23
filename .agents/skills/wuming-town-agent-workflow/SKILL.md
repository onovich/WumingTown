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

## Communication rules

- Messages contain summaries and repository paths, not giant logs or secrets.
- File inbox is the reliable fallback; do not assume arbitrary standalone Codex app threads have a stable public messaging API.
- A completion message is not approval. A verified review is not integration. A merged branch is not done until task state is closed.
- If the same workflow failure happens twice, update this skill, a reference, or `AGENTS.md`.

## References

Read only when needed:

- `references/protocol.md`
- `references/task-schema.md`
- `references/quality-gates.md`
- `references/codex-routing.md`
- `references/native-thread-routing.md`
- `references/native-thread-routing.md`
