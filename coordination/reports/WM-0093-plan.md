# WM-0093 - Crash And Diagnostic Package Path

## Goal

Create a local, privacy-safe M6 diagnostic package path for Web and Windows
product-gate evidence without telemetry, uploads, private paths, secrets or
full save contents.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0093.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- Existing `packages/platform`, Web storage gate, Electron preload allowlist
  and Web/Desktop e2e tests.

## Non-Goals

- No telemetry, network upload, account system or public feedback system.
- No generic Electron `fs`, `shell`, dialog or arbitrary IPC exposure.
- No full save payloads, local filesystem paths, secrets or private user data
  in diagnostic packages or reports.
- No simulation authority, Worker protocol, save format or content baseline
  changes.

## Current Facts And Assumptions

- Web already owns a browser-only OPFS/export gate and can trigger local file
  downloads safely.
- Electron preload currently exposes placeholder `mods` and `saveStore` ports
  only; WM-0091 requires typed allowlist updates before any bridge expansion.
- There is no existing `diagnostics` test filter even though WM-0093 requires
  `pnpm test --filter diagnostics`; the implementation will add the narrow
  filter entry and record it as a task-runner registration deviation.
- Windows host file writing is treated as blocked for WM-0093 unless a reviewed
  diagnostics bridge is added. The product-gate package still records this
  blocker in a sanitized manifest.

## Approach

- Add a platform diagnostics builder that accepts explicit build/platform,
  scenario id, safe hashes, structured errors and safe logs, then returns a
  deterministic JSON package with redaction/path-safety checks.
- Reject or redact local paths, URL-like secrets, credential-looking keys and
  oversized/full-save-like payload fields in structured errors and logs.
- Expose a Web shell diagnostic action that generates the current M6 package
  from release-gate, storage-gate and platform-host state and downloads it as a
  local JSON file.
- Include the diagnostic summary in the shell debug payload so Web and Electron
  e2e can verify status without reading private host state.
- Keep Electron preload unchanged unless absolutely necessary. Desktop tests
  should verify that Windows diagnostics are represented as a safe blocker
  rather than a broad host filesystem bridge.
- Register `pnpm test --filter diagnostics` to run the new focused platform
  diagnostics tests.

## Risks

- Diagnostics can become telemetry if upload/network hooks are introduced.
- A useful package can accidentally include local paths, secrets or full save
  contents.
- Electron diagnostics can tempt broad host APIs. This task will prefer an
  explicit blocker over expanding preload without a reviewed narrow bridge.

## Implementation Steps

1. Add a platform diagnostics module and focused unit tests for package shape,
   hash/scenario capture, structured errors, safe logs and redaction.
2. Register the `diagnostics` unit-test filter in `tools/test-runner.mjs` and
   update WM-0093 task ownership to include this narrow tool registration.
3. Wire Web shell diagnostic state/action through UI and debug payloads, with a
   local download path only.
4. Extend Web e2e to download and inspect the diagnostic package, including no
   telemetry, no private paths, no full save contents and expected M5/M6
   hashes.
5. Extend Desktop e2e to inspect the diagnostic manifest for Electron and
   verify the Windows host package path is safely blocked until a reviewed
   diagnostics bridge exists.
6. Update observability/security docs and write the WM-0093 report.

## Tests And Gates

- `pnpm typecheck`
- `pnpm test --filter diagnostics`
- `pnpm test:e2e`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the diagnostics module, Web action/e2e hooks, test-runner filter and
docs, then record local diagnostics as an M6 blocker for product-gate decision.

## Done Conditions

- Local Web diagnostic package captures build, platform, scenario id, hashes,
  structured errors and safe logs.
- Windows Electron records a safe platform-specific blocker without broad host
  access.
- Packages and reports contain no local paths, secrets or full save contents.
- No telemetry, upload or public feedback path exists.
- Required checks pass and independent reviewer verifies the privacy/platform
  boundary.
