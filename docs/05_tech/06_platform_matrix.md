# Platform Compatibility Matrix

| Capability         | Windows Electron      | Chrome/Edge Web                       | macOS Browser           | Native macOS |
| ------------------ | --------------------- | ------------------------------------- | ----------------------- | ------------ |
| Launch target      | Complete              | Complete after gate, scaled if needed | Best effort             | Later        |
| Save data          | Local files           | OPFS plus import/export               | OPFS plus import/export | Future files |
| Data mods          | Mods directory or ZIP | ZIP import                            | ZIP import              | Future       |
| SharedArrayBuffer  | Controllable          | Requires cross-origin isolation       | Browser-dependent       | Controllable |
| Steam/achievements | Optional              | No                                    | No                      | Future       |
| Max fast-forward   | Target 6x             | Target 3x, raise only after evidence  | Browser-dependent       | Not promised |

## Web Decision Gate

The real vertical-slice target is a 192 x 192 map, 40 active actors and a
20k-entity product-scale runtime that reaches 30 TPS with acceptable memory and
loading behavior in the target browsers.

If the Web tier fails, decisions proceed in order: lower fast-forward, lower
cap, Web as demo-only, then cancel formal Web support. Core simulation is not
rewritten to force Web parity.

## WM-0088 Storage Interoperability Status

- Chrome/Edge Web: WM-0088 proves OPFS local write, read, export, import and
  quota-failure recovery for the M6 gate evidence path.
- Windows Electron: as of WM-0088, desktop preload still exposes placeholder
  unavailable save ports. Windows/Web save-container interoperability is not
  proven and must stay recorded as an M6 product-gate blocker until a reviewed
  desktop save bridge exists.

## WM-0089 SharedArrayBuffer Fallback Status

- Chrome/Edge Web: WM-0089 verifies the non-cross-origin-isolated browser
  Worker path with `SharedArrayBuffer` unavailable. The runtime selects the
  existing structured-clone / Transferable snapshot fallback, and M5 read-only
  Worker projections still match headless hashes.
- Cross-origin isolation: COOP/COEP remains the deployment requirement before
  a future SAB transport can be considered. Lack of isolation is no longer a
  correctness blocker for the current M6 Worker smoke path.
- Product-gate impact: fallback evidence does not prove same-spec Web, higher
  fast-forward, or a 20k-entity continuous browser authority runtime. Until
  product-scale evidence exists, Web stays on the conservative 3x/lower-cap or
  demo-only decision path recorded by the M6 Web gate.

## WM-0090 Windows Electron Package Status

- Windows Electron: WM-0090 produces an external-testable unsigned unpacked
  directory at `dist/desktop/win-unpacked` with executable
  `dist/desktop/win-unpacked/WumingTown.exe`.
- Package evidence: `pnpm build:desktop` writes
  `dist/desktop/wm-desktop-package-report.json` with package kind, artifact
  paths, pinned Electron version, file count, total bytes, content digest,
  security-boundary facts and known warnings.
- Scope boundary: this is not an installer, signing, updater, Steam/store or
  public release upload. Electron remains a platform shell; simulation
  authority remains Worker/headless only.

## WM-0096 Product-Gate Verdicts

- Chrome/Edge Web: verdict `demo-only`. The current product-gate shell can load,
  accept input, use Web save/export/import and export local diagnostics, but it
  is not a measured 30 TPS / 20k-entity browser authority runtime. Same-spec,
  lower fast-forward and lower-cap support remain unproven.
- Windows Electron: verdict `ready-for-controlled-external-test` as an unsigned
  unpacked local directory build. The verdict covers launch, packaged smoke,
  input, security boundaries and product-gate surface visibility only.
- Remaining blockers: Windows/Web save-container interoperability and Windows
  host-side diagnostic package writing require reviewed narrow bridges before
  stronger release or Early Access claims.

## WM-0103 Windows Controlled External Test Instructions

WM-0103 adds M7 tester instructions at
`docs/05_tech/09_m7_windows_controlled_external_test.md`.

The Windows build remains an unsigned unpacked local directory build for
controlled external testing only. It is not an installer, signed build, updater,
Steam/store package, public release, telemetry path, account service, crash
upload service, paid service or public save compatibility commitment.
