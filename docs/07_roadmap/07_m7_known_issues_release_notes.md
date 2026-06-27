# M7 Known Issues And Release Notes Draft

Status: WM-0107 M7 preparation artifact. This document is a draft for
controlled external testing and public playtest evaluation. It is not public
release approval, Early Access launch approval, store submission, signing,
installer distribution, final privacy/legal/store copy, telemetry approval,
public feedback approval or public save compatibility approval.

## Evidence Base

This package consolidates reviewed evidence from:

- WM-0097 M6 closeout.
- WM-0099 first-run onboarding.
- WM-0100 early-game balance/readability.
- WM-0102 privacy, manual feedback and diagnostics readiness.
- WM-0103 Windows controlled external test instructions.
- WM-0104 Web demo-only scope.
- WM-0105 save compatibility policy draft.
- WM-0106 store/playtest material draft package.

Roadmap authority remains: M6 = Web / Windows Product Gate, M7 = Early Access /
public playtest preparation, M8 = 1.0.

## Release Notes Draft

```text
DRAFT - Wuming Town M7 controlled-test notes

This build is for controlled external testing and Early Access/public playtest
evaluation. It is not a public release, not an Early Access launch, not a store
submission and not final legal/privacy/store copy.

What to test:
- First-run onboarding clarity for launch, movement/input, time labels,
  residents, work, hauling/building, saving, events, lamps, Chronicle, town
  ordinances, evidence and structured failure explanations.
- Early first-season readability: resource pressure, night-risk cadence, event
  frequency, recovery windows and blocked-choice explanations.
- Web demo-only expectations in Chrome/Edge.
- Windows controlled-test launch from the unsigned unpacked local directory
  build.
- Local diagnostic export and manual support-note workflow.
- Web save/export/import behavior under the current test envelope.

What this draft does not approve:
- public release or public Web launch;
- Early Access launch;
- store page submission or store asset upload;
- signing, installer or updater distribution;
- telemetry, analytics, accounts, paid services, crash upload or hosted
  feedback;
- final privacy/legal/store claims;
- final or public save compatibility;
- M8 1.0 scope.
```

## Known Issues

### Web

- Web remains `demo-only`.
- Web is not cancelled, but current evidence does not prove same-spec Web,
  lower-fast-forward Web, lower-cap Web or a 30 TPS / 20k-entity browser
  authority runtime.
- Web public launch remains owner-gated.
- Chrome/Edge can run the product-gate shell and current Web smoke path, but
  players must not infer Windows parity.
- Current shell interaction evidence is not final browser performance proof.

### Windows

- Windows is `ready-for-controlled-external-test` only as an unsigned unpacked
  local directory build.
- There is no signed installer, updater, Steam/store package or public release
  build.
- Testers may see operating-system reputation warnings because the build is
  unsigned.
- Moving `WumingTown.exe` out of the unpacked directory is unsupported.

### Diagnostics And Feedback

- Web diagnostic package export is local and user-initiated.
- Windows renderer can show diagnostic state, but Windows host-side diagnostic
  package writing remains blocked until a reviewed narrow diagnostics bridge
  exists.
- There is no telemetry, automatic upload, crash-report upload, hosted support
  intake, public feedback form, account-backed report flow or analytics queue.
- Tester notes, screenshots, short clips and exported diagnostic JSON may be
  shared only through owner-approved controlled-test channels.
- Diagnostic packages must not contain full save contents, secrets, private
  paths, unrelated system logs, crash dumps, account identifiers or payment
  information.

### Saves

- Web OPFS save/export/import is supported only for the current test envelope.
- Browser profile cleanup, private/incognito behavior or browser settings can
  remove local Web saves.
- Windows/Web save-container interoperability is blocked until a reviewed
  desktop save bridge exists.
- Public save compatibility is not promised.
- Future controlled-test builds may reject older test saves with structured
  errors or require a fresh run.
- Full tester save-file collection is forbidden unless a future reviewed
  data-handling task explicitly permits it.

### Balance And Readability

- Event frequency, resource pressure and recovery cadence are under evaluation.
- M5 evidence proves the current deterministic fixture and strategy paths, not
  final balance for all players, all strategies or public release.
- First-run material should teach one pressure/recovery loop before exposing
  every system at once.
- Structured failure explanations are required; reports should include visible
  reason codes or user-facing blocked-choice text where available.

### Cultural And Public Copy

- Public-facing language must remain fictionalized and draft/non-final.
- Do not describe Wuming Town as authentic folklore, historically accurate
  ancient China, real ritual practice, real religion, legal advice, medical
  advice or spiritual advice.
- Any identifiable real ritual, sacred practice, minority-group symbol or
  sensitive historical reference needs owner approval and likely external
  review.

## Player-Support Boundaries

Allowed manual support information:

- OS, browser, display scaling and approximate hardware notes.
- Launch result and whether the product-gate shell was reached.
- Windows unsigned-warning text if the tester chooses to share it.
- Screenshot or typed copy of visible in-app error text.
- Reproduction steps.
- Tester-exported local diagnostic JSON.
- Whether Web save/export/import or Windows local launch succeeded.

Do not collect:

- secrets, tokens, passwords, cookies, private keys or account identifiers;
- unrelated directory listings or private filesystem paths;
- full saves unless a later reviewed task permits it;
- crash dumps, system-wide logs, payment details or sensitive personal data;
- telemetry or analytics in any automatic form.

## Owner-Gated Decisions

The following remain unresolved owner gates:

- Public release.
- Early Access launch.
- Store submission or store page publication.
- Public Web launch or Web verdict change.
- Web cancellation.
- Signed Windows installer, updater, Steam/store package or public build.
- Telemetry, analytics, accounts, paid services, hosted support, crash upload
  or public feedback system.
- Final privacy/legal/store claims.
- Final public save compatibility or cross-platform save interoperability.
- M8 task creation, promotion, implementation or review.

## Downstream Use

WM-0108 must convert this document into tester checklist items for Web,
Windows, diagnostics, save policy, support collection, onboarding readability,
balance readability and cultural/copy clarity.

WM-0109 must cite this document as known-issues evidence and must keep
controlled-test readiness separate from public release, public Web launch,
store submission, final privacy/legal approval and public save compatibility.
