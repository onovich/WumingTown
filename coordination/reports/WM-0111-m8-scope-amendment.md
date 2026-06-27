# WM-0111 M8 Scope Amendment

Status: WM-0111 candidate scope amendment. It becomes authoritative for M8
only after independent review, integration and `done`.

Owner amendment:
`OWNER-AMENDMENT-2026-06-27-UI-I18N-PRODUCTIZATION`.

## Decision

The Owner amendment is compatible with the current Roadmap and locked
decisions. It does not change the subject, platform stack or M8 goal. It
clarifies that M8 1.0 closure must include product UI, responsive layout,
zh-CN/en localization, visual identity, first-play guidance and accessibility
as required gates, not optional polish.

Existing `coordination/reports/WM-0110-future-m8-entry-prompt.md` covers
localization and public-facing copy at a high level, but does not uniquely
define the Owner's required UI/i18n/responsive gates. WM-0111 therefore amends
M8 scope before implementation.

## Screenshot Evidence

The Owner supplied:

- windowed capture: `1424x861`;
- fullscreen capture: `2560x1369`.

Observed issues:

- The default UI still says `M6 Web Product Gate Harness` and exposes
  `Diagnostics` / `Web Product Gate` panels as primary surfaces.
- Most player-visible text is English even though the title includes
  `Wuming Town / 无明镇`.
- Dense diagnostic panels, visible scrollbars and overlapping dark cards make
  the screen read as an internal harness rather than a player-facing game.
- Windowed and fullscreen layouts have different but related information
  hierarchy problems: cards compete with the map, the right resident panel is
  very dense, and the central/bottom Web product-gate panel is debug-oriented.
- The default screen does not clearly distinguish game content from developer
  diagnostics, nor does it tell a first-time player what phase they are in,
  what they can do and what the next goal is.

## Required M8 Gates

### Product UI Gate

The default launch experience must look like a player-usable game UI, not a
diagnostics harness. Diagnostics may remain available only as dev/debug mode or
explicit overlay.

### Responsive Layout Gate

M8 must validate at least:

- `1280x720`
- `1366x768`
- `1424x861`
- `1600x900`
- `1920x1080`
- `2560x1369`
- `2560x1440`

Core UI must not be clipped, overlap incoherently, lose key information, hide
required scroll regions or break after language switching.

### Localization Gate

M8 must support at least `zh-CN` and `en`.

Requirements:

- Chinese browser/system language defaults to `zh-CN`.
- Non-Chinese browser/system language defaults to `en`.
- Settings allow manual language override.
- Player-visible strings use localization keys.
- Missing translations fail tests.
- English fallback is allowed but must not be the default for Chinese players.
- Developer diagnostics may remain English only when isolated from default
  player UI.

### Visual Identity Gate

M8 must establish theme tokens for color, typography, spacing, panels, buttons,
alerts, resource cards, resident cards and debug overlays. The HUD must evoke
Wuming Town's lanterns, Chronicle, ordinances, residents, explanation and night
risk rather than generic Web dashboard style.

### First Playability Gate

The default player flow must include a main/start surface, new/continue/settings
and language selection, brief objective guidance, onboarding or tutorial
support, in-game next-step prompts, and clear separation of game content from
developer diagnostics.

### Accessibility Gate

M8 must prove text readability, non-color-only status, UI scale or font scale,
keyboard/mouse basics, contrast checks, long-text containment, usable scroll
regions and bilingual layout behavior.

## Owner Gates Preserved

The amendment does not approve:

- public release or 1.0 release;
- Early Access launch;
- store submission or store publication;
- public Web launch or Web verdict changes;
- signed Windows installer, updater, Steam/store package or public build;
- telemetry, analytics, accounts, hosted feedback, crash upload or paid
  services;
- final privacy/legal/store claims;
- public save compatibility or Windows/Web save interoperability promises;
- any locked-decision change.

## Required Planning Consequence

The M8 DAG must include implementation and validation tasks that make these
gates real product gates. The closeout reviewer must reject M8 if the default
UI still reads as an internal diagnostics harness or if zh-CN/en responsive
layout evidence is missing.
