# M7 Privacy, Feedback And Diagnostics Readiness

Status: WM-0102 M7 preparation artifact after independent review. This document
is internal readiness material, not a final privacy policy, legal statement,
store claim, public release approval or owner approval for telemetry.

## Verdict To Preserve

M7 can prepare controlled external testing feedback and diagnostics only within
the existing local evidence envelope:

- Web diagnostic package export is available as a user-initiated local browser
  download.
- Windows Electron can show the same renderer-local diagnostic state, but
  host-side diagnostic package writing remains blocked until a reviewed narrow
  diagnostics bridge exists.
- Windows/Web save-container interoperability remains blocked until a reviewed
  desktop save bridge exists.
- `telemetry=false` and `networkUpload=false` remain required diagnostic package
  facts.
- No account, hosted service, crash upload, public feedback system, paid service
  or automatic data collection is approved.

## Local Feedback Model

M7 feedback readiness is manual and controlled.

Allowed feedback channels:

- owner-approved private test coordination;
- tester-written reproduction notes;
- tester-provided screenshots or short clips;
- tester-exported local diagnostic JSON;
- tester-provided OS, browser, display scaling and hardware notes when relevant.

The application must not open a public feedback form, hosted issue intake,
account-backed report flow, analytics endpoint, crash-report upload or
background telemetry path without a new reviewed task and owner approval.

## Diagnostic Package Boundary

The current diagnostic package is the M6 local diagnostic package produced by
the Web product-gate shell and reused by the Windows shell surface:

```text
wuming-town-m6-diagnostics.json
```

The package may contain:

- package kind and schema version;
- build task id, app version placeholder and git commit placeholder;
- runtime browser and platform host facts;
- reviewed scenario id, fixture id and final tick;
- reviewed command/content/read-model hashes;
- recent structured renderer errors after redaction;
- bounded safe logs such as shell-ready and storage-gate summaries;
- blocker codes such as `windows_host_diagnostics_bridge_blocked`.

The package must not contain:

- full save contents;
- private filesystem paths;
- secrets, tokens, cookies, passwords or credential-like values;
- unrelated system logs;
- crash dumps;
- account identifiers or payment information.

The package remains local. Export requires user action. There is no automatic
upload, telemetry queue, network retry, crash-report sender or hosted storage.

## Where Data Lives

| Item | Current storage | M7 boundary |
| --- | --- | --- |
| Web saves | Browser OPFS plus user export/import | Local browser data; no public compatibility promise |
| Web diagnostic JSON | User-initiated browser download | Tester manually shares only through owner-approved channel |
| Windows renderer diagnostic JSON | Renderer-local download surface | Host-side file package remains blocked |
| Windows host diagnostic package | Not available | Blocked pending reviewed narrow diagnostics bridge |
| Tester notes and screenshots | Outside the app | Manual tester-provided support material only |
| Build package report | Producer local artifact | Internal support evidence, not telemetry |

No M7 task may silently create server-side storage for feedback, diagnostics,
accounts, crash reports, saves or analytics.

## Manual Support Collection

Allowed manual support information:

- launch result, product-gate surface reached or not reached;
- operating system, browser, display scaling and approximate hardware facts;
- Windows unsigned-build warning text if the tester chooses to share it;
- visible in-app error text or diagnostic status;
- reproduction steps;
- tester-exported local diagnostic JSON;
- screenshot or short clip of the observed issue;
- whether Web save/export/import or Windows local launch steps succeeded.

Do not request or retain:

- secrets, tokens, passwords, cookies or private keys;
- unrelated private paths or directory listings;
- full save files unless a later reviewed save-handling task permits it;
- full crash dumps or system-wide logs;
- account identifiers, payment details or real-world identity data;
- medical, legal, financial or other sensitive personal information unrelated
  to the test.

## Draft Privacy Statement Boundary

The following is internal draft language for downstream M7 material. It is not a
final public privacy policy:

```text
This controlled test build does not automatically collect telemetry, upload
crash reports, create accounts or send diagnostic data to a server. Testers may
choose to manually share reproduction notes, screenshots and the local
diagnostic JSON exported by the app through the approved test channel. The local
diagnostic package is designed to redact private paths, credential-like values
and full-save-like fields before export.
```

Before this language is used publicly, owner approval is required for final
privacy/legal wording and any public support process.

## Owner Approval Gates

Stop and request owner approval before:

- telemetry, analytics, network upload or crash-report upload;
- account, paid service, hosted feedback, hosted save or cloud sync work;
- final privacy/legal/store/public support claims;
- collecting full saves, crash dumps or system-wide logs;
- broad Electron filesystem access, generic IPC, shell access or clipboard
  access;
- changing save compatibility promises;
- public release, store submission, signing, installer or updater work.

## Downstream Use

WM-0107 must cite this document when drafting known issues and release notes for
privacy, diagnostics, manual feedback and unsupported upload paths.

WM-0108 must cite the allowed and forbidden manual support collection lists in
the tester protocol.

WM-0109 must keep privacy/feedback/diagnostics readiness separate from final
privacy/legal approval, telemetry readiness, crash-upload readiness and public
release readiness.
