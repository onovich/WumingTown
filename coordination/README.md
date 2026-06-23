# Coordination control plane

This directory is mutable project state. Chat summaries are not authoritative.

- `tasks/*.json`: task ownership, dependencies, state and acceptance criteria.
- `reports/<TASK>.md`: implementation evidence and checks.
- `inbox/<ROLE>/*.json`: durable role-to-role messages.
- `roles.json`: available custom roles and model policy.
- `project-state.json`: milestone-level status.
- `decisions/`: short-lived decision requests; accepted decisions graduate to ADRs.
- `blockers/`: optional supporting evidence for blockers.

Use `$wuming-town-agent-workflow` and its `taskctl.mjs`; do not hand-edit task state during normal work.
The root Codex thread is responsible for routing unread inbox entries to live named subagents and acknowledging them only after delivery.
