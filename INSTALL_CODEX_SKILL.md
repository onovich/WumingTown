# Install the Codex workflow skill

The repository already contains the skill at:

```text
.agents/skills/wuming-town-agent-workflow/
```

Codex discovers repository skills after the repository is trusted. Start Codex at the repository root and invoke:

```text
$wuming-town-agent-workflow
```

For user-level installation, copy the entire directory to:

```text
~/.agents/skills/wuming-town-agent-workflow/
```

A standalone bundle is also supplied in `dist/wuming-town-agent-workflow.skill`. It is a ZIP-compatible skill bundle; preserve its internal root directory when installing.

After installation run from the project root:

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status
```

The skill does not depend on an undocumented direct thread API. `complete`, `review` and `block` create durable inbox messages; the root/project-director thread routes those messages to active named subagents using Codex's native steering. This makes the workflow recoverable even after a thread is closed.
