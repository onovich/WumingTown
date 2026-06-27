# Dependency And Security Policy

## New Dependency Gate

New dependencies require an ADR or dependency note covering function,
alternatives, maintainer activity, license, browser/Electron compatibility,
package size, security history and install-script behavior.

## Version Policy

Versions must be pinned and lockfile-backed. Routine upgrades are batched.
Security upgrades take priority. Major framework upgrades move one at a time
and must run the full regression and E2E gate.

## Forbidden

- Unaudited `postinstall` behavior.
- Runtime CDN code.
- Remote network access from mods.
- Electron renderer Node authority.
- Local paths, personal data or full save contents in logs.
- Dynamic `eval` or `new Function`.

## WM-0091 Electron Security Gate

- WM-0091 adds no dependency, lockfile change, installer, signing, updater,
  store or public release upload path.
- Electron remains pinned by `apps/desktop-electron/package.json` and packaged
  through the reviewed WM-0090 unpacked-directory path.
- Preload bridge expansion must update the typed allowlist in
  `apps/desktop-electron/src/preload-contract.ts` and the desktop-shell e2e
  audit before review.
- Generic `fs`, `shell`, arbitrary IPC, renderer Node authority, local path
  leakage, secrets and full save dumps remain forbidden.

## Secrets

The repository must not store secrets. Steam, signing and release credentials
belong only in CI secrets. Agents must not print, copy or commit credentials.
