# WM-0111 Reviewed M8 Task DAG Draft

Status: draft artifact for independent review. Downstream M8 packets stay
`proposed` until WM-0111 is independently reviewed, integrated and marked
`done`.

## Roadmap Authority

- M6 = Web / Windows Product Gate and is closed.
- M7 = Early Access / public playtest preparation and is closed.
- M8 = 1.0.

Old inferred milestone structures remain deprecated. M8 must preserve the M6
Web `demo-only` verdict and Windows unsigned controlled-external-test verdict
unless owner approval and reviewed task packets change them.

## DAG Overview

```text
WM-0111 M8 UI/i18n scope amendment and task DAG
  -> WM-0112 Product UI design system and visual identity
  -> WM-0113 I18n architecture and locale settings contract
      -> WM-0114 Localization infrastructure and missing-key gate
          -> WM-0115 zh-CN/en translation resources and hardcoded string inventory
              -> WM-0116 Main menu, settings and language selection
              -> WM-0117 Player HUD and debug overlay separation
                  -> WM-0118 Responsive viewport and screenshot validation
                      -> WM-0120 Accessibility, readability and UI-scale pass
              -> WM-0119 First-play onboarding and next-action guidance
                  -> WM-0120 Accessibility, readability and UI-scale pass
  -> WM-0121 M8 1.0 content and endgame scope contract
      -> WM-0122 12-15 anomaly roster and content expansion
          -> WM-0123 Full faction and endgame arc integration
              -> WM-0124 Stable data-mod workflow and localization completeness
                  -> WM-0125 Long-save stability and migration gate
                      -> WM-0126 M8 performance, regression and readiness matrix
  WM-0118 -> WM-0126
  WM-0120 -> WM-0126
  WM-0124 -> WM-0126
  WM-0126 -> WM-0127 M8 closeout and future handoff
```

`WM-0127` also depends on all upstream M8 tasks being done, verified and
integrated.

## Common M8 Rules

All M8 tasks must preserve:

- Simulation Worker or Node headless as the only authoritative world writer.
- React and Pixi as consumers of read models, not simulation authority.
- M5 final world/read-model hashes `0xfba70a5c` / `0x9ba83cb7` unless a
  reviewed migration explicitly accepts a changed baseline.
- Benchmark thresholds: 10 percent warning and 20 percent blocking regression.
- Web remains `demo-only`.
- Windows remains unsigned local-directory `ready-for-controlled-external-test`.
- Public release, 1.0 release, EA launch, store submission, public Web launch,
  signing, telemetry, accounts, hosted feedback, crash upload, paid services,
  final privacy/legal/store claims and public save compatibility remain
  owner-gated.

## Task Packets

### WM-0112 - Product UI Design System And Visual Identity

- Owner: gameplay-designer
- Reviewer: reviewer
- Dependencies: WM-0111
- Goal: define the M8 player-facing UI style, HUD information hierarchy and
  token contract before implementation.
- Acceptance highlights: theme tokens, panel/card/button/resource/resident
  styles, debug overlay boundary, Wuming Town fantasy cues and player-readable
  current-state/next-goal model.

### WM-0113 - I18n Architecture And Locale Settings Contract

- Owner: systems-architect
- Reviewer: reviewer
- Dependencies: WM-0111
- Goal: define locale ownership, browser/system detection, manual override,
  persistence and missing-key strategy without changing runtime code yet.

### WM-0114 - Localization Infrastructure And Missing-Key Gate

- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0113
- Goal: implement i18n runtime, locale detection, settings persistence and
  missing-key tests.

### WM-0115 - zh-CN/en Translation Resources And Hardcoded String Inventory

- Owner: content-worker
- Reviewer: reviewer
- Dependencies: WM-0114
- Goal: move player-visible strings into translation resources and produce
  completeness/hardcoded-string evidence.

### WM-0116 - Main Menu, Settings And Language Selection

- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0112, WM-0114, WM-0115
- Goal: add the default player start/settings surface with language switching.

### WM-0117 - Player HUD And Debug Overlay Separation

- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0112, WM-0114, WM-0115
- Goal: replace the default diagnostics harness surface with product HUD and
  move diagnostics to explicit dev/debug mode.

### WM-0118 - Responsive Viewport And Screenshot Validation

- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0116, WM-0117
- Goal: add automated viewport/screenshot or DOM-layout validation for
  `1280x720`, `1366x768`, `1424x861`, `1600x900`, `1920x1080`, `2560x1369`
  and `2560x1440`.

### WM-0119 - First-Play Onboarding And Next-Action Guidance

- Owner: gameplay-designer
- Reviewer: reviewer
- Dependencies: WM-0116, WM-0117
- Goal: make default playability legible: phase, possible actions, next goal,
  game content versus diagnostics and first-run tutorial copy.

### WM-0120 - Accessibility, Readability And UI-Scale Pass

- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0118, WM-0119
- Goal: prove readable text, non-color-only status, scroll usability, keyboard
  and mouse basics, contrast, long-text containment and bilingual UI-scale
  behavior.

### WM-0121 - M8 1.0 Content And Endgame Scope Contract

- Owner: gameplay-designer
- Reviewer: reviewer
- Dependencies: WM-0111
- Goal: define the 1.0 content/endgame scope from the M8 prompt without
  overclaiming release readiness.

### WM-0122 - 12-15 Anomaly Roster And Content Expansion

- Owner: content-worker
- Reviewer: reviewer
- Dependencies: WM-0121
- Goal: expand validated content toward 12-15 anomalies and required localized
  content resources through schema-compliant data.

### WM-0123 - Full Faction And Endgame Arc Integration

- Owner: simulation-engineer
- Reviewer: reviewer
- Dependencies: WM-0122
- Goal: integrate faction/endgame arcs through existing owner stores,
  deterministic state machines and scenario evidence.

### WM-0124 - Stable Data-Mod Workflow And Localization Completeness

- Owner: content-worker
- Reviewer: reviewer
- Dependencies: WM-0115, WM-0122, WM-0123
- Goal: harden data-mod workflow, content validation, localization coverage and
  non-code-mod restrictions for 1.0.

### WM-0125 - Long-Save Stability And Migration Gate

- Owner: systems-architect
- Reviewer: reviewer
- Dependencies: WM-0123, WM-0124
- Goal: validate long-save/migration policy for 1.0 without making public save
  compatibility promises beyond owner-approved scope.

### WM-0126 - M8 Performance, Regression And Readiness Matrix

- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0118, WM-0120, WM-0124, WM-0125
- Goal: consolidate M0-M8 regression, responsive/i18n/accessibility gates,
  long-run scenarios, benchmark evidence and remaining owner gates.

### WM-0127 - M8 Closeout And Future Handoff

- Owner: project-director
- Reviewer: reviewer
- Dependencies: WM-0126
- Goal: close M8 only after all M8 tasks are done, independently verified and
  integrated; write future handoff without executing release actions.
