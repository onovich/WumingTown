# M7 Web Demo-Only Scope Statement

Status: WM-0104 M7 preparation artifact after independent review. This is not
a public Web launch approval, store claim, same-spec support claim or Web
cancellation decision.

## Verdict To Preserve

The M6 Web verdict remains:

```text
Web tier verdict: demo-only
```

Meaning:

- Web remains a formal gated target in the Roadmap.
- The current Chrome/Edge Web path can load and interact with the reviewed
  M5 product-gate shell.
- Web can be shown or tested only with explicit demo expectations.
- Web is not cancelled.
- Web is not approved for public launch.

Not proven:

- same-spec Web support;
- lower-fast-forward Web support;
- lower-cap Web support;
- 30 TPS / 20k-entity browser authority runtime;
- public Web release readiness.

## Safe Public-Draft Language

Use this language in M7 drafts:

```text
The Web build is currently demo-only. It can present the product-gate shell in
Chrome/Edge with local browser save/export/import, local diagnostics and
SharedArrayBuffer-unavailable fallback behavior, but it is not a proven
same-spec or public-release Web version.
```

Short version:

```text
Web: demo-only, Chrome/Edge product-gate shell, not full parity.
```

Any stronger claim requires a later reviewed task with browser authority
runtime evidence and owner approval where release/public-facing promises are
involved.

## Evidence Base

The demo-only statement is grounded in reviewed M6 evidence:

- WM-0086: repeatable Web product-gate harness with fixture
  `wm-0086-web-product-gate`.
- WM-0087: Chrome Stable and Edge Stable shell measurement; same-spec remains
  blocked because the measured browser path is a read-only fixture consumer,
  not a product-scale browser authority runtime.
- WM-0088: Web OPFS local write/read/export/import and quota recovery for the
  M6 gate evidence envelope; no public save compatibility promise.
- WM-0089: non-cross-origin-isolated SharedArrayBuffer-unavailable fallback
  keeps authority in the Worker/projection path.
- WM-0094: Web launch, storage, input and diagnostics smoke coverage in the
  consolidated external-test smoke path.
- WM-0096 and WM-0097: final M6 verdicts and closeout.

## Player-Facing Boundaries

M7 Web drafts may say:

- Chrome/Edge are the current target browsers for the product-gate shell.
- Runtime deliverable estimated gzip bytes were under the M6 150 MB budget.
- The shell can load, accept input and display the M5 product-gate surface.
- Web OPFS save/export/import works for the gate envelope.
- Local Web diagnostic download is covered by M6 smoke evidence.
- SharedArrayBuffer is optional for the current smoke path; without
  cross-origin isolation the runtime uses the structured-clone /
  Transferable snapshot fallback.

M7 Web drafts must not say:

- same-spec Web;
- full Web release;
- Web parity with Windows;
- lower-fast-forward support;
- lower population/map cap support;
- stable public Web saves;
- public Web launch;
- store-ready Web build;
- Web cancellation.

## Performance And Storage Expectations

Current M6 Web evidence is sufficient for demo expectation-setting only:

- Chrome shell-ready: `480 ms`; Edge shell-ready: `456 ms`.
- Chrome interaction P95: `17.1 ms`; Edge interaction P95: `17.4 ms`.
- Chrome frame P95: `18.3 ms`; Edge frame P95: `18.3 ms`.
- JS heap delta in the measured shell: about `0.69 MB`.
- Runtime estimated gzip bytes: `273561`.

Known blockers:

- No measured 30 TPS / 20k-entity browser authority runtime.
- No evidence for lower-fast-forward or lower-cap browser authority tiers.
- Current shell interaction P95 is above the `12 ms` Web main-thread target.
- Windows/Web save-container interoperability is still blocked until a
  reviewed desktop save bridge exists.

## Downstream Use

WM-0106 store/playtest material must quote or paraphrase this document instead
of inventing Web readiness claims.

WM-0107 known issues must include:

- Web is demo-only.
- Same-spec/lower-fast-forward/lower-cap are unproven.
- Web public launch remains owner-gated.
- Public save compatibility remains owner-gated.

WM-0108 tester protocol must ask testers to report:

- whether the demo-only wording is clear;
- whether they inferred Web parity despite the warning;
- browser, storage and diagnostic behavior observed in their environment.

WM-0109 readiness must keep Web demo readiness separate from public Web release
readiness.

## Owner Gates

Owner approval is still required before:

- public Web launch;
- store/public release claims;
- Web cancellation;
- changing the demo-only verdict;
- final privacy/legal/store claims;
- public save compatibility commitment;
- telemetry, accounts, hosted services, paid services, crash upload or public
  feedback systems.
