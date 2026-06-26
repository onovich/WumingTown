# WM-0088 - Web storage OPFS save import export and quota gate

## Goal

Prove the Web shell can persist an M6 gate-scoped save envelope through OPFS,
round-trip it through export/import, surface structured user-facing and
diagnostic errors, and record whether Windows/Electron can consume the same
container or remains a product-gate blocker.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0088.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0086.md`
- `coordination/reports/WM-0087.md`
- `coordination/decisions/ADR-0005.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/07_roadmap/04_web_release_gate.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- `packages/persistence/**`
- `packages/platform/**`
- `packages/ui-react/**`
- `apps/web/**`
- `apps/desktop-electron/src/preload.cjs`
- `apps/desktop-electron/src/desktop-shell.e2e.test.ts`

## Non-Goals

- No simulation-authority changes.
- No `packages/sim-core/**` edits.
- No public save compatibility promise beyond the M6 gate.
- No save codec migration, schema migration or new dependency.
- No secret, local-path or full-save leakage in user-facing errors, reports or
  diagnostics.
- No desktop save-port implementation in WM-0088; desktop status may only be
  inspected and reported as proven or blocked.

## Current Facts And Assumptions

- `packages/persistence` currently exposes smoke constants only; there is no
  Web OPFS save-store implementation yet.
- `packages/platform` resolves to an unavailable browser fallback and does not
  expose save export/import or quota state.
- The current Electron preload bridge still returns placeholder unavailable
  save-store results, so Windows/Web container interoperability is not already
  proven.
- The current Web shell is a deterministic read-only fixture consumer, so this
  task can only prove platform-storage plumbing and M6 gate-envelope behavior;
  it cannot claim broad authoritative gameplay save compatibility.

## Approach

1. Add a narrow persistence layer for an M6 gate-only save envelope:
   - opaque bytes persisted through OPFS A/B slots plus manifest pointer;
   - explicit structured reasons for unavailable storage, not found, invalid
     envelope, export/import failure and quota exhaustion;
   - storage estimate/quota reporting without local-path leakage.
2. Extend the platform Web port to expose:
   - list/read/write/remove;
   - export/import;
   - storage status and quota summary.
3. Add a Web shell storage panel in `packages/ui-react` that:
   - saves the current read-only shell selection state into the gate envelope;
   - loads/imports it back into the shell;
   - exports a browser download;
   - shows user-facing status plus structured diagnostic reason details;
   - records the current Windows interoperability verdict.
4. Add focused persistence unit tests with fake OPFS handles plus Playwright
   coverage for observable save/export/import/quota-recovery behavior.
5. If desktop interoperability still cannot be executed from the current
   placeholder preload, record it explicitly as a product-gate blocker instead
   of guessing compatibility.

## Risks

- Browser `navigator.storage.estimate()` behavior is inconsistent, so quota
  evidence must tolerate missing estimates and still preserve recoverable
  failures.
- A Web-only gate envelope could be mistaken for a public save promise, so code
  and report language must keep the scope explicitly M6-gate-only.
- Export/import UI can easily leak too much detail; diagnostics must stay to
  ids, sizes, hashes and reason codes only.

## Implementation Steps

1. Build the persistence types, gate-envelope codec and OPFS store with fake
   handle tests.
2. Extend platform ports for Web storage/export/import/quota and keep desktop
   fallback typed as unavailable.
3. Thread storage state and actions into the Web shell UI and debug payload.
4. Expand `web-shell` Playwright coverage for save/load/export/import and quota
   recovery, using browser-side storage estimate override for deterministic
   quota failure.
5. Update the persistence/security and platform-matrix docs with M6-gate scope
   and the current desktop interop verdict.
6. Run the required checks and write the final report with explicit blocker
   mapping.

## Tests And Checks

- `pnpm typecheck`
- `pnpm test --filter persistence`
- `pnpm test:e2e --filter web-shell`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the new persistence/platform/Web-shell storage surfaces and report the
Web storage gate as blocked. Do not touch M5 save/replay artifacts, public save
contracts or simulation authority.

## Done Conditions

- OPFS save, load, export, import and quota-failure recovery are covered by
  focused tests and observable Playwright flow.
- UI shows user-facing status plus structured diagnostic reasons for failures.
- Report states explicitly whether Windows/Web save-container interoperability
  is proven or blocked from the current desktop placeholder state.
- No public save compatibility promise beyond the M6 gate is introduced.
