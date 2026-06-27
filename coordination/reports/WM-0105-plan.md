# WM-0105 Execution Plan

## Scope

WM-0105 drafts the M7 external-test save compatibility policy. It must explain
what controlled testers can do with current Web save/export/import evidence,
what Windows cannot yet do, what save breakage is allowed during external
testing, and what remains owner-gated.

## Steps

1. Audit M5 save/replay, M6 Web OPFS and M6 product-gate evidence.
2. Draft a citable M7 save policy with Web import/export instructions, Windows
   blocker language, breakage allowances, data-handling cautions and M5 hash
   protection expectations.
3. Add a focused system/tech note so downstream known-issue, playtest protocol
   and closeout tasks can cite the policy.
4. Run the WM-0105 required checks:
   - `pnpm typecheck`
   - `pnpm test --filter persistence`
   - `pnpm test --filter m5-save-replay`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. Complete WM-0105 to independent review.

## Non-Goals

- No save schema migration.
- No public save compatibility commitment.
- No desktop save bridge, broad host filesystem bridge or arbitrary IPC.
- No cloud save, hosted save service, telemetry, accounts, paid services,
  release upload, store submission, signing, installer, updater or M8 work.
