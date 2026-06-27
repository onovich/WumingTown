# M7 First-Run Onboarding

Status: WM-0099 implementation note.

## Scope

M7 first-run onboarding is a player-facing guide for the current Web/Windows
shell surfaces. It explains what an external tester can inspect during the
first session without changing simulation authority, save format, release
verdicts or content volume.

The path covers:

- Launch readiness, movement and input.
- Time control and speed labels.
- Residents, work, hauling and building through the existing inspector.
- Web saving, import/export and local diagnostics.
- Current event alerts, lamp corridor gap and night-risk cues.
- Chronicle knowledge, town rules, evidence and structured failure reasons.

## Authority Boundary

Simulation Worker or Node headless remains the only authoritative world writer.
React, Pixi, Web and Electron consume read models, shell state and platform
diagnostics only. The onboarding panel is static first-run copy backed by the
existing shell fixture; it does not issue commands, write world state, redesign
the Worker protocol or change save schema.

## Copy Limits

- Web remains `demo-only`; onboarding must not describe Web as same-spec,
  lower-fast-forward, lower-cap or public-release ready.
- Windows remains an unsigned `ready-for-controlled-external-test` local
  directory build; onboarding must not imply signing, installer, updater, store
  upload or public release.
- No telemetry, account, paid service, crash upload or public feedback flow is
  added or promised.
- Public save compatibility remains a draft/owner-gated commitment.
- The path explains existing M5/M6 surfaces only and does not add M8 tutorial
  content volume.

## Unresolved Risks

- The current shell fixture can introduce the path, but it is not a final
  measured browser authority runtime.
- The Windows host save and diagnostic bridges remain blocked, so Windows
  testers still need separate controlled-test instructions.
- Some original WM-0099 input references are absent from the repository:
  `docs/01_design/00_product_brief.md` and
  `docs/01_design/03_player_experience.md`. This note uses the existing design
  overview, player journey, daily loop, UI/UX and system documents instead.
