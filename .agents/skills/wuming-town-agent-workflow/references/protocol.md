# Coordination protocol

The task JSON is authoritative for status and ownership. Reports are authoritative for evidence. Inbox JSON files are authoritative for handoff delivery.

Roles do not edit another role's inbox message. The recipient acknowledges it through `taskctl ack`. The director routes messages to live Codex agents and never acknowledges before routing.

Task transitions:

- worker: ready → claimed/in_progress → review_requested; may block
- reviewer: review_requested → changes_requested or verified
- worker: changes_requested → in_progress → review_requested
- director/integrator: verified → integrated → done

All transitions append immutable history entries.
