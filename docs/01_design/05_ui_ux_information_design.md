# UI, UX And Information Design

## Layers

### World Layer

Pixi canvas renders the map, actors, buildings, lamp coverage, danger overlays,
paths and traces.

### Operation Layer

React HUD renders time, speed, warnings, resource summary, selected object,
construction and command surfaces.

### Management Layer

Management panels cover residents, jobs, town rules, town records, debts,
factions, production and statistics.

### Explanation Layer

Every critical state must expose a reason path: job rejection, mood, capability,
lamp failure, evidence credibility and event pressure.

## Key Screens

1. Dawn overview: the daily decision screen for people, lamps, risk, guests and
   debts.
2. Town chronicle dossier: evidence graph, hypotheses, contradictions,
   confirmed rules, applicability and known resident scope.
3. Old debt ledger: creditors, obligations, trigger conditions, deadlines,
   breach consequences and witnesses.
4. Character inspector: current job, step, needs, wounds, thoughts,
   relationships, beliefs and recent decision.
5. Work explainer: why a job was not done, grouped by filter phase.
6. Lamp network overlay: lamp strength, fuel time, keeper route, boundary leaks
   and anomaly rule modifiers.
7. Dawn review: timeline, evidence, injuries, violated town rules, causality
   and pending decisions.

## Information Fairness

- Uncertain information must use clear visual language and must not be shown as
  confirmed fact.
- Numeric precision must match character knowledge. When a resident knows only
  "possible" or "high confidence", the UI must not show fake precision such as
  `83.47%`.
- If hidden rules cause consequences, the review screen must show available
  clues and ignored warnings.
- Players can inspect true system reasons, but developer truth is shown only in
  development mode.

## Accessibility

- Lamp and danger states must not rely on color alone; use text, icon, texture,
  outline or shape cues.
- UI scaling, text size, reduced flashing and complete paused operation must be
  supported by the product-gate surfaces.
- Critical audio cues must have visual alternatives; night events cannot be
  signaled only through sound.
- Simplified Chinese and English layout must be validated from the prototype
  stage onward.

## WM-0092 Input And Accessibility Baseline

- Product-gate HUD alerts expose visible `WARNING` / `STABLE` severity text and
  `data-alert-severity` attributes in addition to color.
- Web e2e validates pointer selection, keyboard pan/zoom, desktop and compact
  viewport resize, representative text fit, reduced flashing, no audio-only
  cues and non-color storage/interoperability status cues.
- Desktop Electron e2e validates the same shell surface for M5 product-gate
  content, pointer selection, keyboard pan/zoom, non-color status cues, no
  audio/video cues, no active document animations and no horizontal document
  overflow in both dev and packaged Windows launches.
- Current M6 shell has no audio cues. Future audio cues must add visual
  alternatives before acceptance.
- React and Pixi remain read-model consumers; UI tests do not repair or mutate
  authoritative simulation state.
