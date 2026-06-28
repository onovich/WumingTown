# M8 First-Play Guidance

Status: WM-0119 implementation note. Provisional canon until M8 UI/i18n
closeout review accepts it.

## Purpose

M8 first-play guidance extends the M7 first-run onboarding into the default
player-facing shell. It gives a first-time player three readable anchors before
they dismiss the start surface:

1. current phase and why it matters;
2. available actions;
3. next goal derived from visible town pressure.

The guidance is a read-model consumer only. It does not issue commands, write
world state, change save format, alter Simulation Worker authority or add
runtime balance.

## Default UI Contract

The default player UI must show:

- `First-play guidance` / `首次游玩指引`;
- current phase interpretation;
- `Available actions` / `可用行动` with New Game, Continue and Settings
  explained as shell actions;
- selectable targets: residents, structures, lantern posts, visitors and map
  tiles must be named as visible read-model inspection targets;
- camera movement: drag-pan and camera reset must be described as player
  navigation, not developer tooling;
- minimum playable command chain: select a lantern keeper or lamp-relevant
  object, use `Prioritize lamp work` / `优先补灯`, then read the queued HUD
  feedback from the WM-0138 lamp-priority local action chain;
- `Next goal` / `下一目标` from visible alerts, or a localized no-urgent-goal
  fallback;
- a boundary note stating that gameplay guidance is separate from developer
  tools.

Developer tools remain opt-in. Internal diagnostic-gate details, storage gate
details and diagnostic package evidence must not be the default first-play
guide.

After the start surface is dismissed, the player HUD must keep a reachable
first-play guidance surface that repeats the minimum controls and command chain.
This may be a persistent player HUD card or a dismiss/reopen path. The guidance
must point to visible state: selected entity/tile inspector data, town alerts,
the command bar and queued action feedback.

## Scenario Requirements

First-play guidance must keep the game's pillars visible without solving play
with arbitrary stat bonuses or prose-only events:

- Lantern boundaries: night-risk, lamp pressure and boundary wording may appear
  only when supported by visible read-model alerts, resources or inspector
  explanations.
- Chronicle knowledge: evidence, reasons and selected-entity explainers are the
  player's source of knowledge. The UI must not imply hidden omniscience.
- Obligations: social pressure and obligations should appear as visible
  resident state, alerts, decisions or structured reasons.
- Clues and counterevidence: onboarding copy may teach that clues and
  counterevidence exist, but scenario-specific claims require content data or
  read-model evidence.
- Noncombat resolutions: first-play copy should frame investigation, repair,
  negotiation, lamp work, review and ordinance choices as valid next actions.
- Social consequences: copy may warn that choices have social cost only when it
  remains framed as current controlled-test guidance, not final balance.
- Explainability: blocked or risky actions should point to visible reason
  classes such as missing evidence, insufficient lamp coverage, absent recovery
  window or obligation risk.

## Copy Boundaries

This guidance may say:

- Web is `demo-only`;
- Windows is an unsigned controlled external test;
- language changes affect presentation only;
- diagnostics are separate from player guidance;
- the current shell exposes a first-play path for M8 controlled testing.

This guidance must not say or imply:

- final release, public release or Early Access launch;
- store submission, signing, installer, updater or public Web verdict changes;
- telemetry, analytics, accounts, paid services, crash upload or public
  feedback flows;
- final public save compatibility;
- final economy, event cadence or all-strategy balance.

## Cultural Terminology Boundaries

Use the canonical terms from
`docs/04_content_balance/09_m7_public_facing_terminology.md`:

| Chinese | English | Boundary |
| --- | --- | --- |
| 无明镇 | Wuming Town | fictional place/title |
| 镇志 | Chronicle | public knowledge and evidence system |
| 灯网 | lamp network | spatial/civic order, not real ritual |
| 镇规 | town ordinance | in-world rule, not legal advice |
| 旧债 | old debt / obligation | social/systemic obligation |
| 异类 | anomalies / anomalous visitors | avoid "monster" framing |

The copy must not claim authentic folklore, real religious practice, medical
advice, legal advice or historical accuracy.

## Provisional Values

- Guidance priority: highest visible alert severity wins: danger, then warning,
  then stable. This is a UI readability rule, not balance tuning.
- Fallback next goal: when no alert exists, inspect phase, resident state, lamp
  pressure, Chronicle evidence and obligations.
- Diagnostics visibility: default off; explicit diagnostics query only.
