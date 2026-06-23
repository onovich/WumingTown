# WM-0004 - Build the sandboxed Windows Electron shell

## Goal

Deliver a Windows Electron wrapper that loads the existing web client in a sandboxed renderer, exposes only typed placeholder platform ports through preload, and ships with automated development and packaged smoke coverage.

## Read context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0004.json`
- `docs/05_tech/00_tech_stack.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- `coordination/decisions/ADR-0002.md`
- Existing shell/build/test entry points in `apps/web`, `apps/desktop-electron`, `packages/platform`, `tools/test-runner.mjs`, `vitest.config.mjs`

## Non-goals

- No simulation authority changes.
- No real save-file persistence, mod loading, updater, installer signing, or arbitrary IPC surface.
- No app-to-app package dependency from `apps/desktop-electron` to `apps/web`; desktop wraps the built web renderer instead of importing an app public API.
- No reviewer or integration actions in this worker thread.

## Current facts and assumptions

- Verified facts:
  - `taskctl validate`, `taskctl status`, and `taskctl claim --id WM-0004 --agent client-engineer --thread "Electron"` already succeeded in this worktree.
  - `apps/desktop-electron` and `packages/platform` are still skeletons.
  - Root scripts currently lack `build:desktop` and any Electron smoke target.
  - Existing browser smoke uses Playwright + Vite and already exercises the web shell deterministically.
- Design decisions for this task:
  - Use pinned `electron@42.4.1` from the approved tech stack line.
  - Add a pinned packager only if needed for the packaged smoke acceptance path.
  - Keep renderer sandboxed with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
  - Because sandboxed preload scripts cannot rely on Node ESM imports, keep preload implementation compatible with Electron sandbox rules and expose a frozen narrow API via `contextBridge`.
- Temporary assumptions to verify in implementation:
  - A local Windows automated smoke run is an acceptable "approved equivalent" for CI until a dedicated Windows workflow exists in-repo.
  - Playwright Electron automation can drive both the development launch and an unpacked packaged build launch with enough observability for acceptance.

## Approach

- Introduce a typed platform contract in `packages/platform`:
  - host metadata
  - save placeholder port
  - mods placeholder port
  - structured unavailable/error results only
- Keep Electron-specific globals out of normal browser code by resolving platform ports from `window` with a safe web fallback.
- Build desktop as three layers:
  - `apps/web`: Vite build for renderer assets with an explicit CSP suitable for local bundled content.
  - `apps/desktop-electron/main`: BrowserWindow creation, lifecycle, file-or-dev-server URL loading, and security preferences.
  - `apps/desktop-electron/preload`: contextBridge exposure of the typed placeholder ports only.
- Add desktop packaging config that produces an unpacked Windows directory build for smoke validation before installer/signing work exists.
- Add Playwright-based desktop smoke coverage for:
  - development launch against a Vite dev server
  - packaged launch against the built unpacked app
  - security assertions observable from the renderer surface, including missing Node globals and expected host metadata
- Record dependency/security evidence in ADR/report if new runtime dependencies are introduced.

## Risks

- Electron preload format can conflict with sandboxed ESM rules.
  - Mitigation: keep preload implementation in a sandbox-compatible format and type its public contract from `packages/platform`.
- Local file CSP or asset path issues can break packaged launches while dev still works.
  - Mitigation: exercise both dev and built paths in automated smoke.
- Packaging tools often add hidden install hooks or large transitive trees.
  - Mitigation: pin exact versions, inspect lifecycle scripts, capture unpacked size/license/maintenance evidence, and update lockfile deliberately.
- Desktop tests can become flaky if they depend on timing instead of ready markers.
  - Mitigation: reuse deterministic DOM markers and explicit window state/debug payload checks.

## Implementation steps

1. Extend `packages/platform` to define typed placeholder platform ports and a browser-safe resolver/global contract.
2. Add desktop app source structure for main/preload/shared config, plus minimal renderer bootstrap expectations.
3. Add build scripts/config for web renderer output, Electron main/preload emit, and Windows unpacked packaging.
4. Add Playwright desktop smoke tests and hook them into `tools/test-runner.mjs`.
5. Update dependency/security documentation and task report scaffolding with exact evidence.
6. Run required and relevant extra gates, fix regressions, then write `coordination/reports/WM-0004.md`.

## Tests and gates

- Required:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build:desktop`
- Additional if available/relevant:
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm content:validate`
  - `pnpm boundaries:check`
- Smoke evidence:
  - automated dev Electron launch
  - automated packaged Electron launch
  - built artifact path under `dist/` or app-specific output

## Rollback

- Revert desktop-specific manifests/config/scripts and new package pins.
- Remove desktop smoke integration from the test runner.
- Delete generated packaging config/artifacts if the shell cannot meet sandbox/security constraints.

## Done conditions

- BrowserWindow configuration enforces `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Preload exposes only typed placeholder platform ports; no generic `fs`, `shell`, or arbitrary IPC bridge is reachable from the renderer.
- `pnpm build:desktop` produces a working Windows launchable build and automated smoke covers both dev and packaged launch paths.
- Security review has no unresolved high finding and is documented in the task report / ADR evidence.
