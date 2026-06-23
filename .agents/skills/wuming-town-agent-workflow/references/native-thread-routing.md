# Native thread routing

## Codex app / CLI subagents

Keep `project-director` as the parent/root session. After spawning a named custom agent, record its returned thread/session identifier when available:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs register-thread \
  --role simulation-engineer --thread '<THREAD_ID>' --label 'M1 kernel'
```

When `taskctl route` reports unread messages, use Codex's native parent-to-subagent steering to continue that role's active thread with the message summary and repository paths. Acknowledge the inbox entry only after the instruction is delivered.

## Agents SDK / Codex MCP orchestration

The official Codex MCP workflow exposes `codex-reply(threadId, prompt)`. An external orchestrator may read `coordination/thread-registry.json`, call `codex-reply` for every unread role inbox, then run `taskctl ack` only after a successful response.

Do not store API keys, credentials or full sensitive logs in the registry or inbox. Thread IDs are routing metadata, not product data.

## Recovery

A missing or closed thread is not a blocker: spawn the same project-scoped role again, register the replacement thread, and provide the task JSON, report and unread inbox paths. Repository files are authoritative; thread memory is only a cache.
