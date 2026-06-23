# Official and primary references

Access date for all web references: 2026-06-23. URLs are included so the executing team can re-check current behavior before changing tool versions.

## Codex execution environment

- Codex subagents and custom agent files: https://developers.openai.com/codex/subagents
- Codex configuration reference: https://developers.openai.com/codex/config-reference
- Agent Skills format and project installation: https://developers.openai.com/codex/skills
- Codex app parallel worktrees and threads: https://developers.openai.com/codex/app
- Codex Agents SDK / `codex-reply` thread continuation: https://developers.openai.com/codex/guides/agents-sdk

The included workflow intentionally uses repository files as the durable control plane. Native subagent steering may deliver a message immediately, but task and inbox files remain the audit trail and recovery mechanism.

## Web/desktop platform

- Electron releases: https://releases.electronjs.org/
- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- PixiJS v8 renderer guide: https://pixijs.com/8.x/guides/components/renderers
- PixiJS AI/LLM resources: https://pixijs.com/llms
- Vite feature guide (Workers/Wasm/TypeScript): https://vite.dev/guide/features
- React `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- MDN Web Workers: https://developer.mozilla.org/docs/Web/API/Web_Workers_API
- MDN SharedArrayBuffer security requirements: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- MDN OPFS: https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system

## Toolchain policy

Exact package patches must be selected and locked by WM-0002 after a clean compatibility spike. This handoff deliberately avoids pretending a just-released major version is proven. Node 24 LTS, pnpm 11 and TypeScript 5.9 are the baseline family decisions; later majors require an ADR and full gate.
