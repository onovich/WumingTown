# M7 External-Test Save Compatibility Policy Draft

Status: WM-0105 M7 preparation artifact after independent review. This document
is a controlled external-test policy draft, not a final public save
compatibility commitment.

## Verdict To Preserve

Current save readiness is intentionally limited:

- Chrome/Edge Web has M6 gate evidence for OPFS local write, read, export,
  import and quota-failure recovery.
- Web export/import is scoped to the M6 product-gate evidence envelope and the
  current M7 external-test instructions that cite it.
- Windows/Web save-container interoperability is not proven and remains blocked
  until a reviewed desktop save bridge exists.
- The M5 focused save/replay harness remains regression evidence, not a public
  cross-version player-save promise.
- Any final public save compatibility claim requires owner approval.

## Tester-Facing Policy Draft

Use this language only for controlled external-test material unless the owner
approves final public copy:

```text
This test build may change save behavior between builds. Web testers can use
the in-app save, export and import controls for the current test envelope, but
the project does not yet promise long-term or cross-platform save
compatibility. Windows/Web save interoperability is still blocked. Before
installing a newer test build, export any Web test save you want to keep and
expect that some older saves may fail to load in later builds.
```

Do not present the draft as:

- a 1.0 save compatibility commitment;
- a cross-version migration guarantee;
- a Windows/Web interoperability pass;
- a cloud-save, account-save or hosted-save feature;
- a public support promise to recover every old save.

## Web Import / Export Instructions

Controlled Web testers may use the current browser save surface as follows:

1. Save in the Web shell before ending a session.
2. Use the in-app export action to download the current test save envelope.
3. Keep the exported file in a tester-chosen local folder.
4. Use the in-app import action to select an exported file when asked to
   reproduce or restore the current test envelope.
5. If import fails, copy the visible structured error code and reproduction
   steps into the controlled test report.

Boundaries:

- Exported files are local tester files. They are not uploaded by the app.
- Browser OPFS data can be cleared by browser settings, profile cleanup or
  private/incognito behavior.
- Import/export does not prove full gameplay save compatibility for future
  builds or other platforms.
- Do not ask testers to share full save files unless a later reviewed
  data-handling task explicitly permits it.

## Windows Save Boundary

For M7 controlled external testing, Windows remains a local unsigned unpacked
directory build. The current M6/M7 evidence does not prove Windows/Web
save-container interoperability.

Windows policy:

- Do not claim Windows saves can import Web exports.
- Do not claim Web can import Windows saves.
- Do not ask testers to copy arbitrary Windows app directories.
- Do not add broad filesystem, dialog, shell or arbitrary IPC access to work
  around the blocker.
- A future desktop save bridge must be narrow, reviewed, typed, audited by e2e
  tests and consistent with `nodeIntegration=false`, `contextIsolation=true`
  and `sandbox=true`.

## Breakage Allowances

During M7 controlled external testing, the project may:

- reset test saves between builds;
- reject older test envelopes with structured errors;
- require testers to start a new run after balance/content changes;
- limit support to the current controlled build;
- ask testers to export Web test saves before upgrading;
- keep older save recovery as best effort only.

The project must not:

- silently delete user saves without user-visible instructions;
- hide structured load/import failures;
- weaken M5 save/replay or hash gates to accept drift;
- promise indefinite compatibility without owner approval;
- change save schema or migration behavior without a reviewed plan.

## M5 Regression Protection

M7 validation must continue to protect the reviewed M5 evidence:

- scenario id: `m5.alpha_content_framework.first_season.v1`;
- requested seed: `5`;
- authoritative seed: `155`;
- command stream hash: `0x81d37435`;
- content manifest hash: `0xe55d3015`;
- final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.

Required save evidence for M7 validation:

- `pnpm test --filter m5-save-replay` keeps the focused M5 save/load/resume
  harness valid.
- `pnpm test --filter persistence` keeps the Web OPFS gate behavior valid.
- Product-gate and closeout tasks must not weaken the benchmark 10 percent
  warning and 20 percent blocking thresholds.

If a legitimate reviewed change needs to alter protected hashes or save shape,
that change requires explicit migration evidence, reviewer acceptance and owner
approval where public compatibility commitments are affected.

## Owner Approval Gates

Stop and request owner approval before:

- final public save compatibility promises;
- cross-version migration claims;
- Windows/Web save interoperability claims;
- hosted save services, cloud sync, accounts or paid services;
- collecting full tester save files as support material;
- broad Electron filesystem access, generic IPC, shell access or dialog access;
- public release, store submission, signing, installer or updater work;
- deleting, resetting or invalidating player saves as a public policy decision.

## Downstream Use

WM-0107 must cite this policy in known issues and release notes when describing
save limitations, breakage allowances and the Windows/Web interoperability
blocker.

WM-0108 must cite the Web import/export instructions and forbidden full-save
collection rules in the playtest protocol.

WM-0109 must keep save compatibility readiness separate from final public save
commitments, cloud save readiness and Windows/Web interoperability readiness.

WM-0110 must record whether these owner-gated save decisions remain open before
M8 planning begins.
