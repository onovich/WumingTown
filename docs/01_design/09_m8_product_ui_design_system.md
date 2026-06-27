# M8 Product UI Design System And Visual Identity

Status: WM-0112 design-system spec. This is a player-facing UI contract for M8
implementation tasks. It does not implement runtime UI, create final art assets,
approve public release, or change platform verdicts.

Balance and pixel values marked **provisional** are starting targets for M8
implementation and screenshot review, not locked final values.

## Goals

The default M8 screen must read as a playable Wuming Town session rather than
an M6 diagnostics/product-gate harness. A first-time player should be able to
answer, without opening a debug panel:

- What phase of the day is active?
- What is the next useful goal?
- Which resources, residents, tasks, events and night risks need attention?
- Which information is confirmed, suspected, contradicted or developer-only?
- Which actions are available now, and what consequence category they may
  trigger?

## Product Boundaries

- Simulation Worker or Node headless remains the only authority that changes
  world state. React, Pixi and Electron consume read models and issue explicit
  player commands only.
- Diagnostics, product-gate verdicts, fixture hashes, protocol details and
  developer truth must be hidden from the default player HUD. They may appear
  only after an explicit dev/debug action such as a debug route, launch flag or
  keyboard toggle.
- The HUD must expose explanation paths from structured reason data. It must
  not solve confusion with flavor-only prose, hidden modifiers or arbitrary
  stat bonuses.
- Web remains `demo-only`. Windows remains unsigned controlled external test
  unless a later owner-approved task changes that verdict.

## Visual Identity

Wuming Town should feel like a civic record, lamp-bound settlement and
folk-horror management sim rather than a generic web dashboard.

### Identity Cues

| Cue | Product UI expression | Do not use |
| --- | --- | --- |
| Lantern boundaries | Warm amber boundary rings, small lamp icons, fuel and keeper route cues, leak outlines on the map and HUD. | Tower-defense weapon language, neon energy shields, purely decorative lanterns. |
| Chronicle | Ledger-like panels, source badges, evidence confidence, contradiction markers, dawn review timeline. | Omniscient monster encyclopedia, un sourced lore dumps. |
| Ordinances | Posted-rule strips, seal-like rule status icons, enforcement cost and affected resident count. | Real legal claims, unexplained buffs, laws as free bonuses. |
| Residents | Named resident cards, role, current task, need/risk state, recent reason and relationship consequence. | Anonymous unit-stat tiles as the primary social surface. |
| Explanation | Inline "why" affordance for blocked work, risk, evidence and mood; reason chains localize from `ReasonCode`. | Developer truth by default, prose-only event summaries. |
| Folk-horror settlement | Low-saturation wood, paper, ink and dusk tones with restrained anomaly accent colors. | Gore spectacle, authentic folklore claims, all-anomaly monster framing. |

### Canonical Terms

Use the M7 terminology table for player-facing copy:

- `无明镇` / `Wuming Town`
- `镇志` / `Chronicle`
- `灯网` / `lamp network`
- `镇规` / `town ordinance`
- `旧债` / `old debt` or `obligation`
- `异类` / `anomalies` or `anomalous visitors`
- `黎明复盘` / `dawn review`

## Theme Tokens

Token names are implementation-facing contracts. Exact hex values are
**provisional** and should be validated for contrast in WM-0120.

### Color

| Token | Provisional value | Use |
| --- | --- | --- |
| `color.canvas.day` | `#D8C9AA` | Day map-adjacent page base. |
| `color.canvas.dusk` | `#6F5840` | Dusk frame, transitional risk state. |
| `color.canvas.night` | `#161411` | Night frame and map surround. |
| `color.surface.paper` | `#F1E6CC` | Primary readable player panels. |
| `color.surface.wood` | `#6A4A2F` | Toolbars, posted-rule headers. |
| `color.surface.ink` | `#25211B` | High-contrast dark panels. |
| `color.border.lamp` | `#D9963A` | Lamp coverage, selected boundary, active focus. |
| `color.border.record` | `#7E6F55` | Chronicle, ledger and neutral panel rules. |
| `color.text.primary` | `#241E18` | Main text on paper surfaces. |
| `color.text.inverse` | `#F5EAD2` | Text on night or wood surfaces. |
| `color.text.muted` | `#6E6254` | Secondary labels and metadata. |
| `color.status.stable` | `#2F6F4E` | Stable/nonurgent states plus icon/text. |
| `color.status.watch` | `#B57A22` | Needs attention, dusk preparation. |
| `color.status.danger` | `#A33B32` | Immediate risk, injury, breach. |
| `color.status.unknown` | `#5D6580` | Unverified or low-confidence knowledge. |
| `color.status.contradicted` | `#7B4B83` | Counterevidence, contested Chronicle entries. |
| `color.anomaly.accent` | `#3E8C86` | Small anomaly highlight only. |
| `color.debug.surface` | `#10151C` | Explicit debug overlay surface. |
| `color.debug.text` | `#A9D6FF` | Debug-only labels. |

Color is never the only state channel. Every warning, evidence status, lamp
state and resident state also needs text, iconography, texture, shape or border
language.

### Typography

| Token | Provisional value | Use |
| --- | --- | --- |
| `font.family.ui` | system sans-serif with zh-CN capable fallback | HUD, buttons, compact labels. |
| `font.family.record` | readable serif or Song-style fallback | Chronicle headers and ledger titles only. |
| `font.size.caption` | `12px` | Metadata, timestamps, compact badges. |
| `font.size.body` | `14px` | Default HUD and card body. |
| `font.size.bodyLarge` | `16px` | Readable first-run prompts and selected details. |
| `font.size.panelTitle` | `18px` | Panel titles in management surfaces. |
| `font.size.phase` | `22px` | Current phase/time emphasis. |
| `font.weight.regular` | `400` | Body copy. |
| `font.weight.medium` | `600` | Labels, card names, active tab. |
| `font.weight.strong` | `700` | Urgent alert and current phase. |

Typography must not scale with viewport width. UI scale settings may multiply
the token set, and long Chinese/English strings must wrap or truncate with a
tooltip/detail surface rather than overlap.

### Spacing And Shape

| Token | Provisional value | Use |
| --- | --- | --- |
| `space.1` | `4px` | Tight icon-label gaps. |
| `space.2` | `8px` | Card internal rhythm. |
| `space.3` | `12px` | HUD group spacing. |
| `space.4` | `16px` | Panel padding. |
| `space.5` | `24px` | Major layout gap. |
| `radius.panel` | `6px` | Panels and cards. |
| `radius.control` | `4px` | Buttons, inputs and tags. |
| `border.thin` | `1px` | Normal separators. |
| `border.focus` | `2px` | Keyboard focus and selected entities. |

No card should contain another visual card. Management screens may use panels
with repeated cards, but page sections should be full-width bands or unframed
layouts.

## Component Tokens

### Panels

- Player panels use `color.surface.paper` or translucent `color.surface.ink`
  depending on map legibility.
- Panel headers use a compact title, one status badge and at most two command
  buttons.
- Dense tables belong in management screens, not the default HUD.
- A panel that scrolls must have a stable title and action area outside the
  scroll region.

### Buttons

- Primary actions: filled wood/ink surface, clear verb, icon where available.
- Secondary actions: paper surface with record border.
- Dangerous actions: danger border and explicit consequence category, such as
  `may breach ordinance` or `may increase obligation`.
- Disabled buttons expose an explanation affordance from structured reasons.

### Alerts

Alert fields:

- `severity`: stable, watch, danger, unknown, contradicted.
- `source`: lamp, Chronicle, ordinance, resident, resource, event, obligation.
- `timeScope`: now, dusk, tonight, dawn, deadline.
- `reasonCodes`: stable list for explainability.
- `suggestedActions`: player commands or management links, not prose-only.

Alerts must be grouped by consequence: life/safety, lamp boundary, social trust,
obligation, evidence, resource. The default HUD shows the top **provisional** 3
alerts, with a management link for the rest.

### Resource Cards

Resource cards show what can affect immediate planning, not a warehouse dump:

- name and icon;
- current quantity, trend and time coverage when meaningful;
- threshold label such as `enough for tonight`, `low by dusk`, or `blocked by
  route`;
- primary dependency such as keeper, storage, ordinance, route or weather;
- explanation link for shortages.

Default resource strip order is **provisional**:

1. food;
2. lamp oil;
3. medicine;
4. timber/repair material;
5. paper/record supplies;
6. obligation-critical items when active.

### Resident Cards

Resident cards are social-state summaries, not combat stat blocks:

- name, role and current location;
- current task and next job step;
- state badges: need, health, mood, risk, ordinance conflict or obligation;
- latest explainable reason, for example `cannot haul: route crosses unlit
  lane`;
- one social hook: family, witness role, debt relation or faction pressure.

Default HUD resident cards show only residents who are selected, at risk, idle
for explainable reasons, assigned to night duty, or tied to active events.

### Chronicle Cards

Chronicle evidence uses four visible states:

- `confirmed`: enough evidence for current town practice;
- `suspected`: plausible but not settled;
- `contradicted`: active counterevidence exists;
- `obsolete`: previously used but superseded by dawn review.

Each entry must show source count, last update phase, known applicability and
counterevidence count. This protects the "Chronicle is public knowledge, not
omniscience" pillar.

### Debug Overlays

Debug overlays use a distinct dark technical theme and must label themselves
`Debug` or `Diagnostics`. They may include hashes, protocol state, fixture
names, product-gate verdicts and developer truth.

Default player UI must not show:

- `M6 Web Product Gate Harness`;
- raw deterministic hashes;
- worker protocol packet dumps;
- test fixture names;
- release readiness verdicts;
- untranslated diagnostics as primary content.

## Default Player HUD Hierarchy

The default HUD should sit above the Pixi world layer without burying the map
under dense stacked cards.

### Priority Order

1. Current phase, game time, speed and pause state.
2. Next goal or immediate decision.
3. Night risk and lamp boundary status.
4. Critical resources and coverage.
5. Resident state requiring action.
6. Active tasks, events and obligations.
7. Selected object/resident detail.
8. Management entry points.
9. Debug overlay access, hidden unless dev mode is active.

### Layout Contract

Desktop baseline:

- top bar: phase/time/speed, night-risk badge, resource strip;
- left rail: next goal, top alerts and current tasks;
- right rail: selected resident/object and at-risk residents;
- bottom drawer: context actions, Chronicle snippets or dawn review, collapsed
  by default;
- map center: primary spatial play surface, never covered by default diagnostic
  panels.

Compact baseline:

- top bar remains visible;
- left and right rails collapse into tabs or drawers;
- the next goal and night-risk summary stay one tap/click from the map;
- scroll regions are limited to one visible drawer at a time.

### Current Phase

Phase copy should combine system state and planning meaning:

- Dawn: review evidence, injuries, violations and consequences.
- Day: build, produce, investigate and repair.
- Dusk: prepare lamps, routes, residents and ordinances.
- Night: monitor boundary, resolve events and avoid hidden-cost overreaction.

### Next Goal

Next-goal prompts are structured from scenario state:

- `goalId`;
- `phase`;
- `whyNow` reason codes;
- `availableActions`;
- `blockedActions` with reasons;
- `riskIfIgnored`;
- `noncombatOptions` when relevant.

Goal copy must be brief. Detail opens a management or explanation panel.

### Night Risk

Night risk combines lamp coverage, known anomaly conditions, missing residents,
open obligations, unsettled evidence and town ordinance conflicts. It should be
displayed as a labeled tier plus reasons, not a fake-precise percentage.

Provisional tiers:

- Stable: no active high-impact warnings.
- Watch: one or more issues may matter tonight.
- Strained: multiple systems compete for attention.
- Breach: an active boundary, life/safety or obligation failure is unfolding.

## Explainability Contract

Every critical HUD element that asks for attention must answer:

- What was observed?
- What evidence supports it?
- What counterevidence or uncertainty exists?
- Who is affected?
- What noncombat or social resolution exists?
- What consequence may follow if ignored or mishandled?

Structured reasons are required for:

- work not being done;
- resident risk or mood state;
- lamp failure and boundary leak;
- Chronicle confidence changes;
- ordinance conflicts;
- obligation deadlines;
- event selection and resolution pressure.

## Scenario Fixtures For Later Tasks

These are data-driven acceptance scenarios for WM-0117, WM-0118, WM-0119 and
WM-0120. They are not runtime implementations.

| Scenario | Input state | Default HUD expectation | Explainability and consequences |
| --- | --- | --- | --- |
| First dawn after low-risk anomaly | One injured resident, two witness statements, one contradicted Chronicle note. | Dawn phase is primary; next goal is review evidence before assigning full work; Chronicle card shows `contradicted`. | Detail shows clue, counterevidence, affected resident and possible social trust loss if ignored. |
| Dusk lamp preparation | Lamp oil low for one outer lamp, keeper route crosses a blocked lane, one resident assigned night watch. | Dusk phase, night-risk `Watch` or `Strained`, lamp oil card above timber, alert grouped under lamp boundary. | Suggested actions include reassign keeper, repair route, conserve lamp oil; no combat-only solution. |
| Missing traveler at night | Guest not on roster, last seen near old bridge, ordinance requires registered guests indoors. | Night phase, event card and resident/guest state visible; map highlights last known boundary area. | Explanation distinguishes confirmed absence from rumor, shows ordinance conflict and social consequence with guest faction. |
| Resident idle during construction | Builder has skill but refuses route through unlit lane; timber exists. | Resident card appears because idle has a reason; task list does not simply say `no work`. | Work explainer shows path/lamp reason, available repair or daylight options, and no hidden stat penalty. |
| Obligation deadline | Old debt due at dawn, creditor known, required item missing, Chronicle source uncertain. | Obligation alert appears with deadline and uncertainty badge; resource strip promotes obligation-critical item. | Detail shows source reliability, counterevidence count, noncombat negotiation option and breach consequence. |
| Debug requested explicitly | Dev mode toggle or route active. | Player HUD remains intact; debug overlay has distinct dark theme and `Debug` label. | Developer truth and product-gate data are visibly separated from player-facing knowledge. |

## Responsive And Accessibility Expectations

M8 implementation should validate at least the WM-0111 viewport set:

- `1280x720`
- `1366x768`
- `1424x861`
- `1600x900`
- `1920x1080`
- `2560x1369`
- `2560x1440`

Required behavior:

- phase, next goal, night risk and at least the critical resource summary remain
  reachable without opening diagnostics;
- long zh-CN and en strings wrap, truncate with accessible detail, or move into
  a drawer;
- status is not color-only;
- keyboard focus is visible;
- paused operation remains usable;
- no incoherent overlap between HUD, map, drawers and scroll regions.

## Implementation Handoff

Downstream tasks should treat this document as a design contract:

- WM-0113/WM-0114 define localization keys and missing-key behavior for these
  player-facing surfaces.
- WM-0116 creates start/settings/language surfaces without release claims.
- WM-0117 replaces default diagnostics with the player HUD and moves
  diagnostics to explicit debug access.
- WM-0118 validates the responsive viewport set.
- WM-0119 writes first-play guidance using the phase/next-goal model.
- WM-0120 validates readability, non-color status, UI scale and bilingual
  behavior.

