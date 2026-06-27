# M7 Validation Matrix And Readiness Decision

Status: WM-0109 M7 readiness decision artifact. This document consolidates
verified M7 evidence. It is not public release approval, Early Access launch
approval, store submission approval, public Web launch approval, signing
approval, installer/updater approval, telemetry approval, account approval,
paid-service approval, public feedback approval, final privacy/legal/store
copy, public save compatibility approval or M8 startup.

## Roadmap Authority

- M6 = Web / Windows Product Gate.
- M7 = Early Access / public playtest preparation.
- M8 = 1.0.
- Old inferred M6/M7/M8/M9 structures remain deprecated.

M7 readiness is evaluated as preparation. It does not itself launch Early
Access, recruit publicly, publish a store page or approve public release.

## Upstream M7 Evidence

| Task | Evidence | Readiness contribution |
| --- | --- | --- |
| WM-0099 | First-run onboarding path | External testers have a Web/Windows shell path for launch, input, time, residents/work, hauling/building, saving, events, lamps, Chronicle, town ordinances, evidence and structured reasons. |
| WM-0100 | Balance/readability package | Early resource pressure, night-risk cadence, event-frequency and recovery readability are documented as controlled-test focus areas, not final balance. |
| WM-0101 | Cultural review package | Fictionalization, sensitive-topic and terminology gates exist for public-facing drafts. |
| WM-0102 | Privacy/feedback/diagnostics readiness | Feedback remains manual/controlled; diagnostics remain local/user-initiated; telemetry/upload/accounts remain forbidden. |
| WM-0103 | Windows controlled-test instructions | Windows instructions exist for unsigned unpacked local directory testing and support collection. |
| WM-0104 | Web demo-only scope | Web demo-only copy, limitations and blocked claims are documented. |
| WM-0105 | Save compatibility policy draft | Web import/export instructions, save breakage allowances and Windows/Web save blockers are documented without public compatibility promise. |
| WM-0106 | Store/playtest material draft | Non-final descriptions, key claims, screenshot needs, shot list, scope statement and limits exist. |
| WM-0107 | Known issues/release notes | Web/Windows blockers, diagnostics limitations, save risks and support boundaries are consolidated. |
| WM-0108 | Tester protocol/checklist | Controlled-test and Web demo checklist exists and is protected by automated validation. |

All upstream tasks above are `done`, independently reviewed as `verified` and
integrated before this decision.

## Readiness Decision Matrix

| Area | Decision | Evidence | Residual gate |
| --- | --- | --- | --- |
| Early Access preparation | Prepared for owner review, not launch-approved | WM-0099 through WM-0108 produce onboarding, readability, cultural, privacy, platform, save, material, known-issue and protocol packages. | Owner approval still required for EA launch, final store/privacy/legal copy, release artifacts and public save commitments. |
| Public playtest preparation | Prepared as controlled-test/public-playtest evaluation material, not public recruitment-approved | WM-0106, WM-0107 and WM-0108 provide draft material, known issues and tester protocol. | Public recruitment, public feedback service and any public campaign remain owner-gated. |
| Web demo readiness | Ready for demo-only evaluation | WM-0104 preserves Chrome/Edge product-gate shell evidence, Web OPFS gate envelope and local diagnostics. | Web same-spec/lower-fast-forward/lower-cap/browser authority runtime remain unproven; public Web launch remains owner-gated. |
| Windows controlled external test readiness | Ready for controlled external testing only | WM-0103 and WM-0108 define unsigned unpacked directory run/support protocol. | Signing, installer, updater, store package and public Windows release remain owner-gated. |
| Privacy/feedback/diagnostics readiness | Ready for manual/local controlled-test support only | WM-0102 and WM-0108 forbid telemetry/upload/accounts/hosted feedback and define allowed support data. | Final privacy/legal copy, telemetry, crash upload, hosted feedback and account services remain owner-gated. |
| Save compatibility readiness | Ready for controlled-test draft policy only | WM-0105 and WM-0107 define Web test-envelope import/export, breakage allowances and blocked Windows/Web interoperability. | Public save compatibility, cross-version guarantees, Windows/Web interop and full-save collection remain owner-gated. |
| Cultural/public-copy readiness | Ready for internal/controlled draft review | WM-0101 and WM-0106 define fictionalization, blocked authenticity claims and terminology. | External review/owner approval required for real rituals, sacred practices, minority symbols or sensitive historical references. |
| Regression readiness | Pass required WM-0109 gate before integration | Required checks in WM-0109 report include quality, ci:local, m5-invariants, bench and 100000-tick M5 headless. | Any failure blocks WM-0109 integration and M7 closeout. |

## Protected Regression Facts

- M5 scenario id: `m5.alpha_content_framework.first_season.v1`.
- Headless alias: `m5-alpha-content-framework`.
- Requested seed: `5`.
- Authoritative seed: `155`.
- Command stream hash: `0x81d37435`.
- Content manifest hash: `0xe55d3015`.
- Final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.
- Benchmark warning/blocking policy: 10 percent warning and 20 percent
  blocking regression.

## Owner-Gated Residual Decisions

The following remain open and are not approved by WM-0109:

- Public release.
- Early Access launch.
- Public playtest recruitment or public campaign.
- Store submission or store page publication.
- Public Web launch or Web verdict change.
- Web cancellation.
- Signed Windows installer, updater, Steam/store package or public build.
- Telemetry, analytics, accounts, paid services, hosted support, crash upload
  or public feedback system.
- Final privacy/legal/store claims.
- Final public save compatibility, cross-version migration guarantee or
  Windows/Web save interoperability claim.
- Collecting full tester save files.
- Any M8 task creation, promotion, claim, implementation or review.

## WM-0109 Decision

M7 evidence is sufficient to proceed to WM-0110 closeout review, provided the
WM-0109 required regression gates pass and independent review verifies this
matrix.

This decision does not approve public release, Early Access launch, store
submission, public Web launch, signing, telemetry, accounts, paid services,
public feedback, final privacy/legal/store copy, public save compatibility or
M8 startup.
