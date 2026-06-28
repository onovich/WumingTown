# M8 1.0 Readiness Matrix

Status: WM-0127 M8 closeout readiness artifact. This document consolidates
verified M8 evidence for internal 1.0 readiness review, including WM-0128's
benchmark stop-sign clearance. It is not public release approval, public Web
launch approval, Windows public release approval, store submission approval,
signing approval, telemetry approval, account approval, paid-service approval,
hosted-service approval, final privacy/legal approval or public
save-compatibility approval.

## Roadmap Authority

- M6 = Web / Windows Product Gate.
- M7 = Early Access / public playtest preparation.
- M8 = 1.0 readiness evidence and owner review.
- Web verdict remains `demo-only`.
- Windows verdict remains unsigned local-directory
  `ready-for-controlled-external-test`.

M8 readiness is evaluated as internal 1.0 evidence. It does not itself approve
public release, public recruitment, public store copy, public platform verdict
changes, signing, installer/updater distribution, telemetry, account services,
hosted feedback, crash upload, paid services or public save guarantees.

## Upstream M8 Evidence

| Task | Evidence | Readiness contribution |
| --- | --- | --- |
| WM-0112 | Product UI design system and visual identity contract | Defines theme tokens, HUD hierarchy, debug boundary and Wuming Town visual language. |
| WM-0113 | I18n and locale architecture contract | Defines zh-CN/en detection, persistence, completeness and diagnostics isolation without UI authority drift. |
| WM-0114 | Localization runtime and completeness gate | Proves locale defaults, manual override persistence, completeness validation and gated diagnostics in Web/Desktop shells. |
| WM-0115 | Translation inventory and zh-CN default evidence | Separates player UI from diagnostics-only strings and verifies covered Chinese default shell surfaces stay localized. |
| WM-0116 | Default main menu and language entry surface | Establishes player-facing `New Game` / `Continue` / `Settings` / language flow with compact reachability. |
| WM-0117 | Player HUD and diagnostics separation | Keeps default town view player-facing while gating diagnostics behind explicit debug mode. |
| WM-0118 | Responsive matrix evidence | Validates seven required viewports for Web and desktop shells in `zh-CN` and `en`. |
| WM-0119 | First-play guidance | Adds localized phase, next-goal, action and diagnostics-boundary guidance before town entry. |
| WM-0120 | Accessibility and display-scale evidence | Adds shell-local UI scale, non-color-only state, contrast/readability checks and persisted display settings. |
| WM-0121 | 1.0 content/endgame scope contract | Defines anomaly, faction, endgame, data-mod, localization, long-save and regression expectations without release claims. |
| WM-0122 | Anomaly roster spec | Records the 12 accepted plus 3 stretch anomaly targets and preserves M5 protected baselines. |
| WM-0123 | Faction/endgame owner slice | Adds authoritative faction/endgame state, structured reasons, deterministic scenario evidence and preserved M5 hashes. |
| WM-0124 | Data-mod workflow and localization completeness | Hardens fail-closed content validation, required locale coverage and diagnostics-vs-player text inventory. |
| WM-0125 | Focused long-save/migration gate | Proves deterministic save/load/resume evidence for the accepted M8 slice while keeping public compatibility owner-gated. |
| WM-0126 | Readiness matrix stop-sign evidence | Consolidates M8 UI, localization, accessibility, content, data-mod, long-save and regression evidence while recording the initial benchmark stop sign. |
| WM-0128 | Benchmark stop-sign repair/explanation | Clears the WM-0126 benchmark stop sign with current-HEAD full-suite benchmark evidence under unchanged 10 percent warning / 20 percent blocking policy. |

All upstream tasks above are `done`, independently reviewed as `verified` and
integrated before this matrix.

## Readiness Decision Matrix

| Area | Decision | Evidence | Residual gate |
| --- | --- | --- | --- |
| Product UI and visual identity | Ready for internal M8 1.0 evidence review | WM-0112 defines the design system; WM-0116, WM-0117 and WM-0119 implement the player-facing main menu, post-start HUD and first-play guidance. | Final release marketing copy, final art polish and any public claim about shipping quality remain owner-gated. |
| Responsive layout | Ready across the required viewport matrix for the current player shell | WM-0118 validates `1280x720`, `1366x768`, `1424x861`, `1600x900`, `1920x1080`, `2560x1369` and `2560x1440` in `zh-CN` and `en` on Web and desktop; WM-0120 extends compact/tall display checks. | New player surfaces or additional viewport promises require fresh evidence; public platform verdicts do not change here. |
| Localization | Ready for shell and content-workflow evidence, not public copy approval | WM-0113 through WM-0115 define and validate locale defaults, override persistence, completeness and inventory; WM-0118 and WM-0120 preserve bilingual matrix behavior; WM-0124 enforces required locale coverage for approved content workflow. | Diagnostics may remain English-only only when explicitly gated; final public terminology, cultural review and store/public copy remain owner-gated. |
| First playability | Ready for controlled default player flow | WM-0116 establishes the localized main menu and launch path; WM-0117 and WM-0119 explain current phase, next goal, available actions and the diagnostics boundary. | Broader tutorial depth and future scenario-goal richness remain future work and do not become public-release promises. |
| Accessibility | Ready for the current M8 shell baseline | WM-0120 proves shell-local UI scale, explicit text/aria state, contrast, long-text containment, scroll reachability and persisted display preferences; WM-0118 covers bilingual responsive behavior in the required matrix. | World/canvas zoom accessibility, broader assistive-tech claims and any public accessibility certification remain future owner-reviewed work. |
| Content, anomaly, faction and endgame evidence | Ready as a scoped 1.0 evidence package | WM-0121 defines the contract; WM-0122 records the roster target; WM-0123 provides authoritative faction/endgame owner evidence with structured reasons and preserved M5 baselines. | Stretch anomalies may be cut without weakening accepted rows; final shipped lore/public claims remain owner-gated. |
| Data-mod workflow and localization completeness | Ready as a fail-closed data-only workflow | WM-0124 rejects unsafe paths, missing references, missing required locales and canonical `zh-CN` bypasses while preserving data-only mods and forbidden code/runtime surfaces. | New schema kinds, executable mods, network mods, platform API mods and any public mod-support promise remain forbidden or owner-gated. |
| Long-save and migration evidence | Ready for focused internal gate only | WM-0125 proves deterministic save/load/resume evidence for the `m8.faction_endgame.owner_arcs.v1` slice at save tick `72000`, load tick `72001` and final tick `100000`, with owner-gated migration policy validation. | Public save compatibility, cross-version migration guarantees, Windows/Web interop and desktop save bridge readiness remain owner-gated. |
| Performance and M0-M7 regression protection | Ready for internal M8 closeout evidence | WM-0126 records the initial repeated benchmark stop sign without weakening thresholds. WM-0128 then diagnoses that stop sign as stale/measurement-only evidence and verifies current HEAD `aa611cafc2e2060d689e077fa2cfdf9168bec46d` with two full `corepack pnpm bench` passes under the unchanged 10 percent warning / 20 percent blocking policy; the reviewer also reruns a full benchmark pass. Required M5 regression facts remain `0xfba70a5c` / `0x9ba83cb7`. | Benchmark measurements remain machine-sensitive and must be rerun for future release-candidate gates; no baseline or threshold weakening is approved. |
| Platform verdict preservation | Preserved without expansion | WM-0097 and WM-0110 already lock Web to `demo-only` and Windows to unsigned controlled external test only; WM-0126 repeats those verdicts unchanged in the M8 matrix. | Public Web launch, Windows public release, signing, installer, updater and store distribution remain owner-gated. |

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
- Web verdict: `demo-only`.
- Windows verdict: unsigned local-directory
  `ready-for-controlled-external-test`.

## Focused M8 Slice Facts

- Faction/endgame scenario hash: `0x5ca30054`.
- Faction/endgame replay hash equality: `0x5ca30054 == 0x5ca30054`.
- Faction/endgame route outcomes: `2` available, `1` blocked, `2` contested.
- Faction/endgame performance counters: `factionFactVisits=42`,
  `routeVisits=5`, `arcVisits=6`, `capHitCount=0`, `staleRejectCount=0`,
  `maxRouteCandidateCap=1`, `maxRouteScanCap=1`.
- Long-save scenario id: `m8.faction_endgame.owner_arcs.v1`.
- Long-save save/load/final ticks: `72000` / `72001` / `100000`.
- Long-save content-scope hash: `0x65322b35`.
- Long-save command-stream hash: `0x466ebe20`.
- Long-save resumed final world/read-model hashes: `0x0ab6b7ab` /
  `0xbd9ac1cc`.
- Long-save loaded state hash: `0xeb81bdd2`.

## Owner-Gated Residual Decisions

The following remain open and are not approved by WM-0127:

- Public release or 1.0 launch.
- Early Access launch or public playtest recruitment.
- Store submission, store publication, final store copy or trailer release.
- Public Web launch or any change to the Web `demo-only` verdict.
- Signed Windows installer, updater, Steam/store package or public Windows
  build.
- Telemetry, analytics, accounts, paid services, hosted support, crash upload
  or public feedback systems.
- Final privacy, legal, cultural, historical, medical, spiritual or marketing
  claims.
- Public save compatibility, cross-version migration guarantee, Windows/Web
  interop claim, desktop save bridge claim, cloud save or hosted save support.
- Executable mods, platform API mods, network mods or unreviewed schema kinds.
- Any change to locked decisions without owner approval.

## WM-0127 Closeout Decision

WM-0127 closes M8 as internal 1.0 readiness evidence after WM-0111 through
WM-0126 and WM-0128 are `done`, independently reviewed as `verified` and
integrated. The matrix consolidates the reviewed UI, localization,
accessibility, content, data-mod, long-save and benchmark evidence, and records
that the WM-0126 benchmark stop sign was cleared by WM-0128 without weakening
thresholds or changing product verdicts.

M8 closeout is sufficient for owner review as a 1.0 readiness artifact. It is
not a public 1.0 release action and does not approve public release, public Web
launch, Windows public release, store submission, signing, telemetry, accounts,
paid services, final public copy or public save compatibility.
