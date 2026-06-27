# WM-0098 Reviewed M7 Task DAG Draft

Status: draft artifact for independent review.

This document defines the M7 task DAG to be instantiated by WM-0098 from the
verified WM-0097 future M7 entry prompt. Downstream M7 task packets must remain
`proposed` until WM-0098 is independently reviewed, integrated and marked done;
normal `taskctl` dependency promotion may then unlock ready work.

## Roadmap Authority

The current repository Roadmap is authoritative:

- M6 is Web / Windows Product Gate and is closed.
- M7 is Early Access / public playtest preparation.
- M8 is 1.0.

Old inferred M6/M7/M8/M9 structures remain deprecated. M7 is preparation for
external player testing and Early Access evaluation; it is not public release,
store submission, signing, telemetry, account services, paid services, M8
content closeout or a change to the M6 Web/Windows verdicts.

## DAG Overview

```text
WM-0098 M7 planning package and task DAG
  -> WM-0099 Tutorial onboarding and first-run player path
  -> WM-0100 Early-game balance and readability pass
  -> WM-0101 Cultural review package and terminology safety
  -> WM-0102 Privacy, feedback and diagnostics readiness package
  -> WM-0103 Windows controlled external test instructions
  -> WM-0104 Web demo-only scope statement
  -> WM-0105 Save compatibility policy draft
      -> WM-0106 Store and public playtest material draft
      -> WM-0107 Known issues and release notes draft
          -> WM-0108 Playtest checklist and tester protocol
              -> WM-0109 M7 validation matrix and readiness decision
                  -> WM-0110 M7 closeout and future M8 entry prompt
```

`WM-0106` also depends on WM-0099, WM-0100, WM-0101, WM-0103 and WM-0104.
`WM-0107` also depends on WM-0099, WM-0100, WM-0102, WM-0103, WM-0104 and
WM-0105. `WM-0108` also depends on WM-0101, WM-0102, WM-0103, WM-0104,
WM-0105 and WM-0106. `WM-0109` depends on WM-0099 through WM-0108. `WM-0110`
depends on WM-0109.

The graph is acyclic and intentionally separates public-facing material,
privacy/feedback, cultural review, platform instructions, Web demo scope and
save compatibility so no single task can silently waive an owner gate.

## Common M7 Rules

All M7 tasks must preserve:

- Simulation Worker or Node headless as the only authoritative world writer.
- UI, Pixi, React, Electron, platform storage and diagnostics as consumers or
  platform surfaces, not simulation authority.
- M5 final hashes `0xfba70a5c` / `0x9ba83cb7` unless a reviewed migration
  explicitly accepts a changed baseline.
- Benchmark warning/blocking thresholds: 10 percent warning and 20 percent
  blocking regression.
- Web verdict remains `demo-only`.
- Windows verdict remains unsigned local-directory
  `ready-for-controlled-external-test`.
- Public release, Early Access release, store submission, signing, telemetry,
  accounts, paid services, crash upload, public feedback systems, final
  privacy/legal claims and public save compatibility commitments remain
  owner-gated.
- No M8 task creation, promotion, claim, implementation or review.

## Task Packets

### WM-0099 - Tutorial Onboarding And First-Run Player Path

- Milestone: M7
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - Provides an external-player first-run path covering launch, movement/input,
    time control, residents/work, hauling/building, saving, events, lamps,
    Chronicle, town rules, evidence and structured failure explanations.
  - Adds or updates automated smoke coverage for the onboarding path.
  - Does not add M8-scale tutorial content or make UI authoritative.

### WM-0100 - Early-Game Balance And Readability Pass

- Milestone: M7
- Owner: gameplay-designer
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - Records early resource pressure, night-risk cadence, event frequency,
    failure recovery and player-understanding risks.
  - Uses existing M5 alpha content framework evidence and data where possible.
  - Produces a verified balance/readability package without rewriting core
    systems or weakening regression gates.

### WM-0101 - Cultural Review Package And Terminology Safety

- Milestone: M7
- Owner: gameplay-designer
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - Reviews folk-horror/zhiguai expression, fictionalization, sensitive-topic
    handling and Chinese/English terminology.
  - Ensures public-facing material does not present fictional content as real
    folklore or historical/religious claims.
  - Records unresolved cultural risks and owner gates.

### WM-0102 - Privacy, Feedback And Diagnostics Readiness Package

- Milestone: M7
- Owner: systems-architect
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - Defines local feedback and diagnostic package readiness without automatic
    upload, telemetry, accounts or external services.
  - Carries forward the Web local diagnostic pass and Windows host diagnostics
    blocker from M6.
  - Records privacy statement draft boundaries and owner gates.

### WM-0103 - Windows Controlled External Test Instructions

- Milestone: M7
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - Produces tester installation/run instructions for the unsigned unpacked
    Windows directory build.
  - Documents scope, known warnings, diagnostics, support collection and
    non-goals: no signing, installer, updater, store upload or public release.
  - Verifies current build/smoke commands still support the instructions.

### WM-0104 - Web Demo-Only Scope Statement

- Milestone: M7
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - States Web demo scope, limitations, performance/storage expectations and
    player-facing boundaries.
  - Ensures Web is not described as same-spec, lower-fast-forward or full
    release support.
  - Keeps Web OPFS/import/export and diagnostic evidence grounded in M6.

### WM-0105 - Save Compatibility Policy Draft

- Milestone: M7
- Owner: systems-architect
- Reviewer: reviewer
- Dependencies: WM-0098
- Acceptance:
  - Drafts external-test save compatibility policy, import/export instructions,
    breakage allowances and known risks.
  - Does not make a final public save compatibility commitment without owner
    approval.
  - Carries Windows/Web save-container interoperability as a blocker.

### WM-0106 - Store And Public Playtest Material Draft

- Milestone: M7
- Owner: gameplay-designer
- Reviewer: reviewer
- Dependencies: WM-0099, WM-0100, WM-0101, WM-0103, WM-0104
- Acceptance:
  - Drafts non-final store/playtest materials: description, key claims,
    screenshot needs, trailer/GIF shot list, scope statement and known limits.
  - Does not create final store claims, submit store pages or public release.
  - Incorporates cultural review, Web demo-only and Windows controlled-test
    boundaries.

### WM-0107 - Known Issues And Release Notes Draft

- Milestone: M7
- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0099, WM-0100, WM-0102, WM-0103, WM-0104, WM-0105
- Acceptance:
  - Drafts known issues and external-test release notes from verified M6/M7
    evidence.
  - Records Web/Windows blockers, diagnostics limitations, save policy risks
    and player-support boundaries.
  - Does not hide failed gates or overclaim readiness.

### WM-0108 - Playtest Checklist And Tester Protocol

- Milestone: M7
- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0101, WM-0102, WM-0103, WM-0104, WM-0105, WM-0106, WM-0107
- Acceptance:
  - Produces a tester protocol and checklist for Windows controlled external
    test and Web demo-only evaluation.
  - Includes tutorial, balance, privacy/diagnostics, cultural-risk, save,
    known-issues and feedback checks.
  - Adds an automated checklist validation when feasible.

### WM-0109 - M7 Validation Matrix And Readiness Decision

- Milestone: M7
- Owner: project-director
- Reviewer: reviewer
- Dependencies: WM-0099, WM-0100, WM-0101, WM-0102, WM-0103, WM-0104,
  WM-0105, WM-0106, WM-0107, WM-0108
- Acceptance:
  - Consolidates all M7 evidence into a readiness decision matrix.
  - Records EA readiness, public playtest readiness, Web demo readiness and
    Windows controlled external test readiness.
  - Runs M0-M6 regression gates required by M7 and records owner-gated
    residual decisions.

### WM-0110 - M7 Closeout And Future M8 Entry Prompt

- Milestone: M7
- Owner: project-director
- Reviewer: reviewer
- Dependencies: WM-0109
- Acceptance:
  - Closes M7 only after all M7 tasks are done and independently reviewed.
  - Records completed capabilities, validation matrix, technical debt, cultural
    review state, privacy/feedback state, save compatibility commitment state,
    owner gates and M8 readiness verdict.
  - Writes a non-executable future M8 entry prompt.
  - Does not start M8.
