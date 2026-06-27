# WM-0091 - Electron security and preload audit

## Goal

Audit and lock the Electron security posture and preload API surface for the M6 Windows product gate without expanding into storage implementation, diagnostics implementation, installer, signing, updater, store or M7 work.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0091.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0090.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- `docs/06_engineering/04_review_checklist.md`
- `apps/desktop-electron/**`
- `packages/platform/**`

## Non-Goals

- No storage bridge implementation.
- No diagnostic package implementation.
- No generic `fs`, `shell`, `ipcRenderer` or arbitrary IPC exposure.
- No weakening of `contextIsolation`, `nodeIntegration` or `sandbox`.
- No new dependency, installer, signing, updater, store, public release or M7 scope.
- No simulation authority changes.

## Current Facts And Assumptions

- `apps/desktop-electron/src/main.ts` already creates `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`.
- `apps/desktop-electron/src/preload.cjs` exposes a frozen placeholder bridge with `host`, `mods` and `saveStore` only.
- The current bridge returns unavailable results for storage and mod operations; there is no diagnostics API yet.
- `desktop-shell.e2e.test.ts` already proves renderer sandbox facts and placeholder save-store behavior.

## Approach

1. Add a typed preload contract in `apps/desktop-electron/src/preload-contract.ts` that lists the approved top-level bridge keys, storage methods, mod methods, host facts, unavailable error and forbidden API families.
2. Extend desktop-shell e2e to compare the runtime preload bridge against the typed allowlist and assert no generic host API keys are exposed.
3. Keep `preload.cjs` sandbox-compatible CommonJS and unchanged in authority; no IPC or filesystem API is added.
4. Record the audit result in persistence/security and dependency/security docs.
5. Write WM-0091 report with explicit evidence and residual follow-up for WM-0093 diagnostics.

## Risks

- A future diagnostic feature could bypass the allowlist unless it updates the typed contract and e2e.
- The preload implementation is CommonJS for Electron sandbox compatibility, so the typed contract is a reviewed allowlist rather than a runtime import.
- Over-auditing could drift into implementation of storage or diagnostics; keep WM-0091 to locking and evidence.

## Tests And Checks

- `pnpm typecheck`
- `pnpm test:e2e --filter desktop-shell`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the typed contract, e2e audit assertions, docs and report. Windows external-test verdict would remain blocked on preload/security audit evidence.

## Done Conditions

- BrowserWindow security preferences are verified and documented.
- Runtime preload bridge exactly matches the typed allowlist.
- No generic host APIs or arbitrary IPC are exposed.
- Storage remains placeholder unavailable and diagnostics remain unimplemented until WM-0093.
