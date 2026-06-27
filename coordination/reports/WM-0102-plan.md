# WM-0102 Execution Plan

## Scope

WM-0102 prepares M7 privacy, manual feedback and diagnostics readiness for
controlled external testing. The task is documentation and evidence packaging
only; it must not add telemetry, network upload, hosted feedback, accounts,
crash upload, paid services, final legal privacy claims or public save
compatibility commitments.

## Steps

1. Audit M6 diagnostics, platform and closeout evidence from WM-0093 through
   WM-0097, plus the reviewed M7 DAG from WM-0098.
2. Draft a citable M7 readiness document that records local diagnostic package
   behavior, manual tester-support data, storage locations, forbidden data and
   owner approval gates.
3. Add a short technical index note so downstream M7 tasks can find and cite the
   readiness package.
4. Run the WM-0102 required checks:
   - `pnpm typecheck`
   - `pnpm test:e2e --filter web-shell`
   - `pnpm test:e2e --filter desktop-shell`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. Complete WM-0102 to the independent reviewer with acceptance evidence and
   unresolved gates.

## Non-Goals

- No telemetry, upload, analytics, account, paid service, crash upload or hosted
  feedback implementation.
- No broad Electron filesystem, shell, clipboard or arbitrary IPC bridge.
- No final privacy/legal/store claim.
- No public release, store submission, signing, installer or updater work.
- No save schema, public save compatibility promise or M8 work.
