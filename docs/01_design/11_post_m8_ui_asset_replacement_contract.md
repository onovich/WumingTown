# Post-M8 UI Asset Replacement Contract

Status: WM-0131 architecture contract. This document extends
`docs/01_design/09_m8_product_ui_design_system.md` for the post-M8 owner
remediation pass. It defines semantic tokens, component slots and asset
replacement rules only. It does not implement product code, approve final art,
create external licensing commitments, change save formats or change Web /
Windows release verdicts.

## Scope

This contract turns the owner art direction and art consultation into a stable
handoff for WM-0132, WM-0133, WM-0135 and WM-0140.

The near-term remediation goal is a playable, inspectable HUD using CSS and
Pixi placeholders. Final cut-in art, portrait batches and licensed external
assets remain future owner-gated production work.

## ADR-0131: Semantic Asset Slots Over Direct Art References

Decision: UI code and Pixi render code must reference semantic asset slots and
semantic design tokens, not final image filenames, artboard names or external
source identities. A versioned asset manifest maps slots to placeholder or final
assets.

Alternatives considered:

- Direct CSS/Pixi file references in components. Rejected because it bakes final
  art decisions into product logic and makes replacement risky.
- Artboard-driven replacement using source image labels such as A/B/C. Rejected
  because A/B/C are consultation inputs, not durable product contracts.
- Runtime directory scanning for assets. Rejected because it creates hidden
  shared state, unversioned cache behavior and non-reviewable asset discovery.
- Remote asset service or CDN. Rejected for this remediation pass because it
  adds dependency, security, availability and licensing concerns outside scope.

Migration implications:

- WM-0133 may introduce CSS custom properties and local placeholder slot maps.
- Future art replacement migrates by editing the manifest version and asset
  paths, while component code keeps the same slot identifiers.
- Existing CSS-only placeholders remain the fallback until a slot is explicitly
  marked `approved`.

Rollback:

- Revert to the previous manifest version or the built-in placeholder manifest.
- A missing, invalid or unapproved final asset must fail closed to placeholders,
  not to broken UI or hidden logic branches.

Test implications:

- Manifest validation must cover required fields, slot uniqueness, state
  coverage, relative paths, no player-visible raster text and fallback presence.
- UI tests should assert semantic slot usage through stable class names, data
  attributes or manifest keys rather than image filenames.
- Visual tests should compare layout, overlap and state visibility. They should
  not require final art for WM-0132 through WM-0140.

Performance implications:

- No runtime directory scan, remote fetch, unbounded atlas rebuild or per-tick
  asset lookup is allowed.
- Asset resolution happens at startup, route load or explicit theme change.
- Pixi map effects should use reusable textures, masks and tints; React should
  not allocate asset descriptors during simulation ticks.

Security and licensing implications:

- The manifest records license review status but does not grant rights.
- All external art acquisition, paid asset use, store art or third-party
  licensing remains owner-gated and out of this remediation pass.
- No runtime CDN code, online asset service or dynamic script evaluation is
  introduced.

## Module Sourcing Record

The consultation modules are advisory source material. Durable implementation
contracts are the semantic roles below.

| Product module | Source basis | Contract |
| --- | --- | --- |
| Main desktop layout | B | Top status bar, left resident rail, central map, right inspector and bottom command bar are the default desktop shape. |
| Visual mood | C | Wood, paper, ink, lamp light and restrained folk-horror texture guide the surface language. |
| Map lamp and path language | A + C | A contributes readable lamp circles and path clarity; C contributes dark boundary and lamp-edge atmosphere. |
| Resident list | B | The left rail prioritizes selected, at-risk, idle-with-reason, night-duty and event-linked residents. |
| Inspector | C + A | C contributes segmented ledger order; A contributes task, reason and action density. |
| Command bar | B + C | B contributes grouped command structure; C contributes large tactile paper/wood button language. |

This record must not be used to copy final images. It exists to preserve design
intent while letting placeholders and future approved assets use stable slots.

## Semantic Design Tokens

Token names are product contracts. Exact values may remain provisional, but
downstream code should depend on token names rather than raw values.

### Color Tokens

| Token | Current value | Use |
| --- | --- | --- |
| `color.canvas.day` | `#D8C9AA` | Day map-adjacent base. |
| `color.canvas.dusk` | `#6F5840` | Dusk transition frame and risk bridge. |
| `color.canvas.night` | `#161411` | Night surround and unknown map boundary. |
| `color.surface.paper` | `#F1E6CC` | Primary readable player panels. |
| `color.surface.agedPaper` | `#D8C49B` | Alert strips, task slips and posted notes. |
| `color.surface.wood` | `#6A4A2F` | Top/bottom tool rails and button trays. |
| `color.surface.ink` | `#25211B` | High-contrast dark overlays. |
| `color.border.record` | `#7E6F55` | Ledger dividers and neutral panel rules. |
| `color.border.lamp` | `#D9963A` | Lamp coverage, focus and selected map boundary. |
| `color.status.stable` | `#2F6F4E` | Stable state plus icon/text. |
| `color.status.watch` | `#B57A22` | Attention or dusk preparation state. |
| `color.status.danger` | `#A33B32` | Immediate risk or breach state. |
| `color.status.unknown` | `#5D6580` | Unverified knowledge. |
| `color.status.contradicted` | `#7B4B83` | Active counterevidence. |
| `color.anomaly.accent` | `#3E8C86` | Small anomaly highlight only. |
| `color.debug.surface` | `#10151C` | Explicit debug/diagnostics overlay only. |

Status cannot rely on color alone. Every status-bearing component also needs
text, icon shape, border shape, pattern or a localized reason affordance.

### Typography Tokens

| Token | Contract |
| --- | --- |
| `font.family.ui` | System sans-serif with zh-CN capable fallback for dense HUD text. |
| `font.family.record` | Readable serif or Song-style fallback for ledger titles only. |
| `font.size.caption` | 12px metadata and compact badges. |
| `font.size.body` | 14px default HUD text. |
| `font.size.bodyLarge` | 16px selected details and first-play prompts. |
| `font.size.panelTitle` | 18px panel titles. |
| `font.size.phase` | 20-22px phase/time emphasis. |

Typography must not scale with viewport width. Long zh-CN and English strings
wrap, truncate with accessible detail, or move into stable scroll regions.

### Shape, Texture And State Tokens

| Token | Contract |
| --- | --- |
| `radius.panel` | 4-6px panel radius, avoiding modern SaaS pill language. |
| `radius.control` | 4px controls and tags. |
| `border.thin` | 1px dividers and record lines. |
| `border.focus` | 2px keyboard focus or map selection. |
| `texture.paper.primary` | CSS placeholder now, future nine-slice slot later. |
| `texture.paper.alert` | Aged note or warning strip surface. |
| `texture.wood.toolbar` | Dark wood tray with restrained grain. |
| `texture.ink.debug` | Technical dark overlay separate from player HUD. |
| `state.disabled.explained` | Disabled controls always expose a structured reason. |

## Component Hierarchy

The default player route is a read-model consumer. React owns layout,
accessibility, localization and explicit command requests. Pixi owns visual map
rendering and map interaction feedback. Neither React nor Pixi becomes
Simulation Worker authority.

```text
PlayerHudShell
  TopStatusBar
    PhaseTimeCluster
    SpeedPauseControls
    ResourceStrip
  AlertStrip
    AlertSlip[0..3]
  HudBody
    ResidentRail
      ResidentListItem
    WorldViewportHost
      PixiWorldCanvas
      MapInteractionOverlay
    InspectorPanel
      InspectorHeader
      StatusSection
      CurrentTaskSection
      ReasonSection
      ContextActionSection
  CommandBar
    GlobalModeGroup
    ContextCommandGroup
  ExplicitDebugOverlay
```

Ownership rules:

- `TopStatusBar` reads phase, time, speed, pause state and critical resources.
- `AlertStrip` reads grouped alerts and emits navigation/detail requests.
- `ResidentRail` reads the prioritized resident summary only; it does not scan
  the whole simulation or construct hidden resident state.
- `WorldViewportHost` owns canvas sizing and input routing. It emits selection,
  pan, zoom and locate requests through explicit UI adapters.
- `InspectorPanel` renders selected-object read models and structured reasons.
- `CommandBar` emits explicit command or adapter requests. Unsupported commands
  render disabled with localized reasons.
- `ExplicitDebugOverlay` is opt-in and visually separate. It may show hashes,
  fixture names and protocol details only in debug mode.

No component should contain visual cards inside visual cards. Repeated items
may be cards inside a rail or panel; page-level sections remain unframed bands
or stable HUD regions.

## Asset Manifest Contract

Future art replacement uses a versioned manifest. Product code references only
the `slot` field.

```json
{
  "schemaVersion": 1,
  "assetVersion": "wm-ui-art.v1",
  "assetRoot": "assets/ui",
  "localeScope": "visual-only",
  "licensePolicy": "owner-gated",
  "cacheKey": "wm-ui-art.v1",
  "slots": [
    {
      "slot": "panel.paper.primary",
      "kind": "ui-surface",
      "type": "nineSlice",
      "src": "panels/panel-paper-primary.png",
      "states": ["default"],
      "nineSlice": { "left": 18, "top": 18, "right": 18, "bottom": 18 },
      "minSize": { "w": 96, "h": 64 },
      "pixelRatio": 1,
      "tintPolicy": "none",
      "textPolicy": "no-player-visible-text",
      "fallbackSlot": "panel.paper.primary.placeholder",
      "approvalStatus": "placeholder",
      "licenseReviewRef": null
    }
  ]
}
```

Required manifest fields:

| Field | Requirement |
| --- | --- |
| `schemaVersion` | Integer schema version for validation and migration. |
| `assetVersion` | Human-readable asset set version; no scattered cachebusters. |
| `assetRoot` | Relative root. Absolute paths, user paths and URLs are forbidden. |
| `localeScope` | `visual-only` unless a future owner-approved localization art task changes it. |
| `licensePolicy` | `owner-gated` until owner records approval. |
| `cacheKey` | Versioned key derived from manifest identity. |
| `slots` | Explicit array; no runtime directory scan. |

Required slot fields:

| Field | Requirement |
| --- | --- |
| `slot` | Stable semantic slot name. |
| `kind` | `ui-surface`, `ui-icon`, `map-effect`, `portrait`, `cutin`, `stamp` or `cursor-feedback`. |
| `type` | `cssPlaceholder`, `raster`, `svg`, `nineSlice`, `mask`, `spriteSheet` or `atlasRegion`. |
| `src` | Relative asset path, or `null` for generated CSS/Pixi placeholders. |
| `states` | Explicit supported states, for example default/hover/active/disabled. |
| `nineSlice` | Required for stretchable panels and buttons. |
| `minSize` | Required for surfaces and buttons. |
| `pixelRatio` | Numeric source density. |
| `tintPolicy` | `none`, `singleTint`, `statusTint` or `lampTint`. |
| `textPolicy` | Must forbid player-visible raster text for normal UI assets. |
| `fallbackSlot` | Required for final art slots. |
| `approvalStatus` | `placeholder`, `candidate`, `approved`, `rejected` or `retired`. |
| `licenseReviewRef` | Nullable reference to an owner-approved licensing record. Null is not approval. |

## Slot Naming

Slot names use lowercase dot segments. File names use lowercase kebab-case and
may mirror the semantic slot. Chinese file names are not used.

Core slots:

- `panel.paper.primary`
- `panel.paper.alert`
- `panel.wood.toolbar`
- `panel.ledger.inspector`
- `button.primary.default`
- `button.primary.hover`
- `button.primary.active`
- `button.primary.disabled`
- `button.secondary.default`
- `button.secondary.hover`
- `button.secondary.active`
- `button.secondary.disabled`
- `button.danger.default`
- `button.danger.hover`
- `button.danger.active`
- `button.danger.disabled`
- `stamp.confirmed`
- `stamp.suspected`
- `stamp.contradicted`
- `stamp.obsolete`
- `stamp.forbidden`
- `stamp.missing`
- `icon.resource.food`
- `icon.resource.lampOil`
- `icon.resource.medicine`
- `icon.resource.timber`
- `icon.resource.paper`
- `icon.resource.money`
- `icon.resource.obligationItem`
- `icon.mode.build`
- `icon.mode.zone`
- `icon.mode.work`
- `icon.mode.ordinance`
- `icon.mode.chronicle`
- `icon.mode.nightWatch`
- `icon.mode.investigate`
- `icon.source.lamp`
- `icon.source.resident`
- `icon.source.resource`
- `icon.source.event`
- `icon.source.ordinance`
- `icon.source.obligation`
- `icon.source.chronicle`
- `icon.source.anomaly`
- `map.effect.lampCoverage`
- `map.effect.lampLeak`
- `map.effect.pathPreview`
- `map.effect.pathBlocked`
- `map.effect.selection`
- `map.effect.hover`
- `map.effect.regionBoundary`
- `map.effect.patrolRoute`
- `portrait.role.resident`
- `portrait.role.lampkeeper`
- `portrait.role.medic`
- `portrait.role.chronicler`
- `portrait.role.visitor`
- `portrait.role.merchant`
- `portrait.role.watch`

Future cut-in slots:

- `cutin.event.boundary.watch`
- `cutin.event.boundary.breach`
- `cutin.event.obligation.deadline`
- `cutin.event.chronicle.contradiction`
- `cutin.resident.generic.injured`
- `cutin.resident.generic.missing`
- `cutin.location.bridge.night`
- `cutin.location.lampPost.dusk`

Cut-in slots are optional production targets. They must never be required for
WM-0132 through WM-0140 acceptance.

## Replacement Rules

- Replace by manifest version and semantic slot, not by editing component code.
- Images must not contain player-visible UI text. Locale text remains rendered
  by the i18n layer.
- If a decorative stamp includes glyph-like marks, the marks are decorative and
  cannot be the only carrier of status meaning.
- Panels and buttons need nine-slice data before approval.
- Icons need at least 24px and 48px source suitability or an equivalent scalable
  source.
- Map effects should be masks or neutral alpha textures that can be tinted by
  status or lamp color tokens.
- Portraits may begin as 128x128 placeholders and be cropped to 48x48 or 64x64
  in lists.
- Selection, hover and locate effects must use distinct visual strength.
- Asset loading must use explicit manifest entries. It must not scan asset
  folders globally or infer slot meaning from filenames.
- Final art candidates without `approvalStatus: "approved"` must not replace
  placeholders in default builds.

## High-Cost Art Out Of Scope

The remediation pass must not spend implementation time or approval authority
on:

- full hand-painted map replacement;
- complete character portrait or standing-art batch production;
- cinematic fullscreen main menu art;
- anomaly bestiary or explicit monster portraits;
- final event cut-in illustration sets;
- store capsules, trailer art, public release marketing art or platform page
  imagery;
- paid asset packs, commissioned art contracts or third-party license purchase;
- real-world legal, religious or culturally sensitive symbol systems;
- per-locale raster text assets;
- high-fidelity animation, skeletal animation or new art runtime dependencies.

These items may be tracked as future production needs after owner approval, but
they are not blockers for the post-M8 playable HUD remediation.

## Integration Guidance

### WM-0132: HUD And Diagnostics Separation

- Build the default HUD around the component hierarchy in this document.
- Keep diagnostics behind an explicit route, flag or debug toggle with
  `color.debug.surface` and clear Debug/Diagnostics labeling.
- The HUD may use placeholder slots and CSS textures; it must not expose
  product-gate, fixture, hash or protocol details as primary player content.
- React may issue explicit commands or detail requests only. It must not mutate
  world state or become simulation authority.

### WM-0133: Tokens And Component Styling

- Implement token names first, then map them to CSS variables and Pixi style
  constants.
- Provide placeholder implementations for required slots. Do not import final
  art or commit external licensing assumptions.
- Use semantic slot identifiers in data attributes or style APIs where useful
  for tests.
- Keep cards shallow: repeated item cards inside rails are fine; nested visual
  cards inside panels are not.

### WM-0135: Responsive Layout Gate

- Treat B-derived layout regions as responsive anchors: top bar, resident rail,
  map viewport, inspector and command bar.
- At 1280x720 and 1366x768, rails may collapse to drawers/tabs, but phase,
  critical resource summary, map controls and command access remain reachable.
- Long zh-CN and English labels must wrap, truncate with detail, or move into a
  stable scroll region without overlapping map or controls.
- Final art is not required for screenshot acceptance; placeholder slots are
  sufficient if layout and state meaning are visible.

### WM-0140: Visual And Interaction Evidence

- Capture evidence for default HUD and explicit diagnostics as separate states.
- Screenshot naming should record viewport, locale, route/state and whether
  placeholders or approved art slots are active.
- Major clipping, overlap, missing command surfaces, missing selection feedback
  or missing camera controls are blockers. Absence of final cut-in art is not a
  blocker if placeholder slots are present and recorded as residual production
  need.
- Residual visual-production needs should be listed separately from functional
  remediation blockers.

