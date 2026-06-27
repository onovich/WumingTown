# WM-0090 - Windows Electron package gate

## Goal

Produce and verify a reproducible Windows Electron unpacked external-test build for the M6 product gate, while keeping Electron as a platform shell and not simulation authority.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0090.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `docs/05_tech/00_tech_stack.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- `apps/desktop-electron/**`
- `packages/platform/**`
- `packages/ui-react/**`
- `packages/renderer-pixi/**`

## Non-Goals

- No installer, signing, updater, store, public upload or M7 work.
- No new packaging dependency.
- No renderer Node integration, generic `fs`, `shell` or arbitrary IPC.
- No simulation authority changes.
- No Windows save bridge implementation; placeholder unavailable ports remain a recorded product-gate blocker.

## Current Facts And Assumptions

- `pnpm build:desktop` already builds the Web renderer, Electron main process and a custom Windows `win-unpacked` directory from the pinned `electron` dependency.
- The current Electron shell uses `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`.
- `pnpm test:e2e --filter desktop-shell` already launches both the dev-server shell and packaged Windows directory build on Windows.
- The existing packaged e2e proves the shell loads from `file:///`, but WM-0090 still needs machine-readable artifact metadata and explicit M5 product-surface evidence.

## Approach

1. Extend `apps/desktop-electron/package-dir.ts` to write a deterministic package report into `dist/desktop/wm-desktop-package-report.json`.
2. Include package kind, build command, Electron version, relative artifact paths, package metadata, file count, total bytes, content digest, security boundary and known warnings in the report.
3. Extend the desktop-shell e2e to assert the package report and the current M5 product-gate fixture surface from the shell debug payload.
4. Update the platform matrix with the WM-0090 Windows external-test package status.
5. Record artifact path, size, report path and warnings in `coordination/reports/WM-0090.md`.

## Risks

- Package output can be large; the report should record size and digest without committing generated artifacts.
- Renderer build warnings may be confused with failure; record them as known warnings and keep the product gate decision for later consolidation.
- Packaging evidence must not imply installer/signing/updater readiness.

## Tests And Checks

- `pnpm build:desktop`
- `pnpm test:e2e --filter desktop-shell`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the package report generation, e2e assertions, docs and task report. Windows external-test build evidence would remain insufficient and WM-0090 would stay blocked.

## Done Conditions

- `pnpm build:desktop` creates `dist/desktop/win-unpacked/WumingTown.exe`.
- `dist/desktop/wm-desktop-package-report.json` records artifact metadata, size, digest and warnings.
- Desktop e2e opens the packaged build, confirms sandbox boundary and sees the M5 product-gate fixture surface.
- No Electron authority or security boundary is weakened.
