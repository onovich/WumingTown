# Coordination protocol

The task JSON is authoritative for status and ownership. Reports are authoritative for evidence. Inbox JSON files are authoritative for handoff delivery.

Roles do not edit another role's inbox message. The recipient acknowledges it through `taskctl ack`. The director routes messages to live Codex agents and never acknowledges before routing.

Task transitions:

- worker: ready → claimed/in_progress → review_requested; may block
- reviewer: review_requested → changes_requested or verified
- worker: changes_requested → in_progress → review_requested
- director/integrator: verified → integrated → done

All transitions append immutable history entries.

## Approval-gated abandoned task lock recovery

`taskctl` protects each transition with the fail-closed file
`coordination/tasks/<TASK-ID>.json.lock`. A lock failure does not by itself prove
that the lock is abandoned. Never remove a lock after the first failure and
never add time-based automatic lock eviction.

Consider recovery only after the exact same transition reports the same lock
failure twice, with a wait between attempts. Before removal, all of the
following must be true:

1. Every worker, reviewer and director operation for the task is complete or
   idle, and no `taskctl` transition for that task is in flight.
2. Resolve the absolute path and verify it is exactly
   `<repo>/coordination/tasks/<TASK-ID>.json.lock`. Reject path traversal,
   symlinks, wildcards and any path outside that directory.
3. Inspect the file without editing it. The current lock format is zero bytes;
   a non-empty lock is unfamiliar and must not be removed automatically.
4. Record creation/last-write time and current UTC time. The lock must predate
   both failed attempts and remain after at least a 60-second quiet interval.
5. Confirm the task JSON still has the expected pre-transition state and the
   worktree has no unexpected implementation or control-plane drift.

If any check is uncertain, stop and report a blocker. If every check passes,
request explicit user approval to remove only that exact file. On Windows use
`Remove-Item -LiteralPath <resolved-absolute-lock-path>` with no wildcard,
recursion or computed multi-file list. Then rerun the original `taskctl`
transition once and record the incident in the task report or integration
summary.

If the transition still fails, do not remove more files or mutate task state by
hand. Block the task and repair the workflow under its own reviewed
coordination task.
