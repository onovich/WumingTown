# Routing messages to Codex agents

Codex subagents are explicitly spawned by the parent thread. The parent can steer a running subagent, wait for results, and close completed threads.

Routing procedure:

1. Run `taskctl route`.
2. For each message, identify its `to` role.
3. If a matching custom agent is active, instruct Codex: "Route this follow-up to <agent>: read <message path> and act on task <id>."
4. If none is active, explicitly spawn that custom agent with the message and task paths.
5. After the agent confirms receipt, run `taskctl ack`.

The script deliberately does not call undocumented thread APIs. This keeps the workflow durable across Codex surfaces and versions.
