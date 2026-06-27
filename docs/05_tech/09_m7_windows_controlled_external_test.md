# M7 Windows Controlled External Test Instructions

Status: WM-0103 M7 preparation artifact after independent review. This document
does not approve public release, signing, installer, updater, store upload,
telemetry, crash upload, account services, paid services or public save
compatibility.

## Verdict To Preserve

The M6 Windows verdict remains:

```text
ready-for-controlled-external-test
```

Meaning:

- The build is an unsigned unpacked local directory build.
- Testers run `WumingTown.exe` from that directory.
- Testing is controlled, bounded and manually distributed.
- The build is not an installer.
- The build is not signed.
- The build is not approved for public release or store submission.

## Build Producer Instructions

From the repository root:

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
& 'C:\Program Files\nodejs\pnpm.CMD' build:desktop
```

Expected local output:

```text
dist/desktop/win-unpacked/WumingTown.exe
dist/desktop/wm-desktop-package-report.json
```

Before sharing with controlled testers, the producer must verify:

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
& 'C:\Program Files\nodejs\pnpm.CMD' test:e2e --filter desktop-shell
```

The package report records package kind, file count, total bytes, content
digest, Electron version and security-boundary facts. Do not edit that report
manually.

## Tester Run Instructions

1. Receive the unpacked directory through the approved controlled-test channel.
2. Keep the directory intact. Do not move only `WumingTown.exe` out of it.
3. Run:

   ```text
   dist/desktop/win-unpacked/WumingTown.exe
   ```

4. Confirm the product-gate shell opens and shows the M5 first-season
   product-gate surface.
5. Check basic input:
   - pointer selection on the map;
   - keyboard pan/zoom;
   - visible non-color status cues;
   - compact window layout if relevant.
6. Check the diagnostics blocker text if diagnostics are requested.
7. Record observed OS version, display scaling, GPU if known, launch result,
   input result, any error text and reproduction steps.

Do not expect installer, updater, Steam integration, achievements, telemetry,
crash upload, accounts or cloud save.

## Support Collection

Allowed manual support information:

- Windows version and architecture.
- Whether the build launched.
- Whether Windows SmartScreen or antivirus warned about unsigned software.
- Screenshot or typed copy of visible in-app error text.
- Product-gate surface reached or not reached.
- Input/accessibility observations.
- Diagnostic blocker text or local diagnostic JSON when explicitly exported by
  the tester.
- Steps to reproduce.

Do not collect:

- secrets, tokens, private file paths or unrelated directories;
- full save contents unless a later reviewed task defines safe handling;
- system-wide logs;
- crash dumps uploaded automatically;
- account identifiers or payment information.

## Security Boundaries

The controlled external test build preserves the M6 Electron boundaries:

- `nodeIntegration=false`
- `contextIsolation=true`
- `sandbox=true`
- renderer has no `process` or `require`
- preload exposes only the reviewed allowlist

Simulation authority remains Simulation Worker or Node headless only. Electron
is a platform shell and must not directly mutate authoritative world state.

## Known Limitations

- The build is unsigned and unpacked.
- Windows/Web save-container interoperability is not proven.
- Windows host-side diagnostic package writing remains blocked until a reviewed
  narrow diagnostics bridge exists.
- Web remains `demo-only`; Windows controlled test does not imply Web parity.
- The build may trigger Windows reputation warnings because it is unsigned.
- Package size includes Electron runtime payload and is not a store/install
  footprint commitment.

## Non-Goals

This M7 instruction set does not authorize:

- installer creation;
- code signing;
- updater implementation;
- Steam/store package or upload;
- public release;
- public recruitment campaign;
- telemetry, account system, paid service or hosted crash upload;
- broad filesystem bridge or arbitrary IPC;
- final legal, privacy, store or public save compatibility claims;
- M8 work.

## Downstream Use

WM-0106 may cite this document for Windows scope in non-final store/playtest
drafts.

WM-0107 must cite these known issues and limitations.

WM-0108 must include these run and support-collection steps in the tester
protocol.

WM-0109 must keep Windows controlled external test readiness separate from
public release, signed installer and store readiness.
