# WM-0127 Future Owner Release Handoff

Status: non-executable owner-decision handoff. This file does not create,
promote, claim, implement or review any post-M8 task. It is not approval for
public release, 1.0 launch, store submission, signing, telemetry, accounts,
paid services, hosted feedback, public Web launch, public Windows release or
public save compatibility.

## Current Authority

- M6 = Web / Windows Product Gate, closed.
- M7 = Early Access / public playtest preparation, closed.
- M8 = 1.0 internal readiness evidence, closed by WM-0127 after independent
  review and integration.
- Web verdict remains `demo-only`.
- Windows verdict remains unsigned local-directory
  `ready-for-controlled-external-test`.
- Benchmark warning/blocking policy remains 10 percent and 20 percent.
- Protected M5 alpha content framework hashes remain:
  - final world hash `0xfba70a5c`;
  - final read-model hash `0x9ba83cb7`;
  - content manifest hash `0xe55d3015`;
  - command stream hash `0x81d37435`.

## What M8 Provides

M8 provides reviewed internal readiness evidence for:

- productized default player UI and diagnostics separation;
- responsive Web/Desktop shell behavior across `1280x720`, `1366x768`,
  `1424x861`, `1600x900`, `1920x1080`, `2560x1369` and `2560x1440`;
- `zh-CN` and `en` localization defaults, override and missing-key coverage;
- Wuming Town visual identity tokens and player HUD hierarchy;
- first-play guidance and next-step explanation;
- accessibility/readability/UI-scale baseline;
- scoped 1.0 anomaly, faction/endgame, data-mod and long-save evidence;
- current benchmark stop-sign clearance without baseline or threshold changes.

## Owner Approval Still Required

Before any public-facing or external commitment, the owner must explicitly
approve a new reviewed task packet for that action:

- public 1.0 release or public release-candidate distribution;
- Steam/store submission, store publication, final store copy or trailer;
- public Web launch or any change to the Web `demo-only` verdict;
- signed Windows installer, updater, store package or public Windows build;
- telemetry, analytics, hosted feedback, crash upload, accounts or paid
  services;
- final privacy/legal/compliance/store claims;
- public save compatibility, cross-version migration guarantees, cloud save or
  Windows/Web save interoperability claims;
- executable mods, network mods, platform API mods or any unreviewed schema
  kind.

## Suggested Next Owner Decision Packet

If the owner wants to move beyond internal readiness, send a new goal that
chooses exactly one decision lane:

1. `Release-candidate audit only`: produce a public-release gap audit and
   owner approval checklist without publishing anything.
2. `Controlled external test refresh`: refresh unsigned Windows controlled-test
   and Web demo-only materials without changing platform verdicts.
3. `Public release planning`: create a reviewed task DAG for public release
   preparation, with owner gates for store, signing, privacy/legal, telemetry,
   accounts, paid services and save compatibility.

Recommended first lane: `Release-candidate audit only`. It is the lowest-risk
way to convert M8 readiness evidence into an owner decision without crossing
any public-release gate.
