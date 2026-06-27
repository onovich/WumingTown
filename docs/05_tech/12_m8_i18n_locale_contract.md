# M8 I18n Architecture And Locale Settings Contract

Status: Proposed by WM-0113. See
[`ADR-0011`](../../coordination/decisions/ADR-0011.md).

## Scope

This contract defines the M8 internationalization architecture for the player
surface before localization implementation starts.

It covers:

- supported player locales: `zh-CN` and `en`;
- browser/system locale detection;
- manual override and persistence scope for Web and Windows;
- missing-key, fallback, pseudo-localization and completeness behavior;
- developer diagnostic isolation;
- downstream verification expectations for WM-0114, WM-0115, WM-0116,
  WM-0118 and WM-0120.

It does not implement runtime code, translation resources, UI layout, save
schema, telemetry, accounts, hosted services, release/store/signing work or
public compatibility claims.

## Architecture Principles

Locale is presentation state, not simulation authority.

- Simulation Worker and Node headless remain the only authoritative world
  writers.
- `sim-core`, `sim-worker` and `sim-protocol` must not depend on DOM, React,
  PixiJS, Electron, Node filesystem, real time or localized UI resources.
- Authoritative systems emit structured ids, reason codes, entity ids, content
  def ids, integer values and named interpolation fields. They do not emit
  player-facing prose.
- React, Pixi and Electron render localized projections only. They may change
  active UI locale, but they may not mutate world state or repair read-model
  divergence.
- Translation resources are loaded and validated at the UI/content boundary.
  They are not part of Save Container state and are not exported with player
  saves.

## Locale Model

The supported player locale ids for M8 are:

```text
zh-CN
en
```

`zh-CN` is Simplified Chinese. `en` is English. Both are left-to-right in M8.

Pseudo-localization may be generated for development and layout testing under a
non-player id such as `en-XA`, but pseudo locale is not a supported player
locale, not exposed in default settings and not persisted as a manual player
choice.

Locale-sensitive state has this shape conceptually:

```ts
type LocaleId = "zh-CN" | "en";

type LocaleSource = "system" | "manual";

interface LocalePreferenceV1 {
  readonly version: 1;
  readonly source: LocaleSource;
  readonly manualLocale?: LocaleId;
}
```

`resolvedLocale` is derived at runtime from `LocalePreferenceV1` plus current
system/browser candidates. It should not be stored as authority because system
mode must follow the next launch environment.

## Detection And Resolution

Resolution order:

1. If a valid manual override exists, use that locale.
2. Otherwise, inspect browser/system locale candidates in order.
3. If the first matching candidate has primary language `zh`, resolve to
   `zh-CN`.
4. For every other candidate, including empty, malformed or unsupported tags,
   resolve to `en`.

Chinese detection is intentionally broad for M8. `zh`, `zh-CN`, `zh-Hans`,
`zh-Hans-CN`, `zh-SG`, `zh-Hant`, `zh-TW` and `zh-HK` all resolve to `zh-CN`
until Traditional Chinese is an accepted locale.

Web candidate source:

- read `navigator.languages` first;
- fall back to `navigator.language`;
- never use network, account profile, telemetry, save data or remote config.

Windows Electron candidate source:

- use Chromium renderer language candidates when they reflect the OS/browser
  environment well enough for M8 tests;
- if a host bridge is needed later, expose only a narrow readonly call such as
  `locale.getPreferredLanguages(): Promise<readonly string[]>`;
- the bridge must return BCP 47 tags only and must not expose filesystem,
  shell, arbitrary IPC, paths, account identifiers, environment dumps or
  telemetry.

Malformed stored preferences fail closed to system mode and emit local
development diagnostics. They must not crash the product UI or fall back to an
English default before checking Chinese system candidates.

## Manual Override And Persistence

Manual language selection is an application preference, not a save field.

Web persistence:

- store only `LocalePreferenceV1` in origin-scoped browser preference storage,
  for example `localStorage` under a versioned key such as
  `wuming-town.locale.v1`;
- if storage is unavailable, keep an in-memory preference for the session and
  show a structured local reason to the settings UI;
- clearing browser site data resets the preference to system detection.

Windows persistence:

- prefer the same renderer origin preference storage used by the packaged
  Electron app;
- do not write locale into save slots, diagnostic packages, accounts, telemetry
  or release metadata;
- if packaged Windows evidence proves renderer storage is not durable enough,
  a later task may add a narrow typed preference preload surface with only
  `getLocalePreferenceV1`, `setLocalePreferenceV1` and
  `clearLocalePreferenceV1`;
- any such preload change must update the typed allowlist and desktop-shell e2e
  audit required by the Electron security policy.

Forbidden persistence surfaces:

- Save Container sections and save export/import payloads;
- Simulation Worker or headless world state;
- generic Electron `fs`, `shell`, `ipcRenderer`, `process`, `require`, dialog,
  clipboard or path APIs;
- telemetry, accounts, cloud sync, hosted feedback or paid services.

## Translation Resource Contract

Player-visible text uses stable localization keys. The UI may compose text from
keys and named parameters, but it must not build player-facing sentences by
concatenating localized fragments inside hot render paths.

Required key classes:

- `ui.*`: player-facing shell, HUD, menu, settings and accessibility text;
- `content.*`: content/catalog/player terminology that can be shown directly;
- `reason.*`: presentation text for structured simulation reason codes;
- `dev.*`: developer diagnostics, debug tools and internal harness text.

`ui.*`, `content.*` and `reason.*` are player-visible unless a task explicitly
marks a key as debug-only. They require complete `zh-CN` and `en` entries.

`dev.*` may remain English-only only when isolated behind a dev/debug mode or
explicit diagnostics surface that is absent from the default player launch. If
a diagnostic string appears in the default player UI, it becomes player-visible
and must be localized.

Every formatted key declares its named parameters and accepted scalar shapes.
Missing parameters, extra required parameters, invalid enum values and unsafe
markup fail tests. Locale resources are data, not code; dynamic evaluation is
forbidden.

## Missing-Key And Fallback Behavior

Completeness checks are required:

- all player-visible keys must exist in both `zh-CN` and `en`;
- both locales must expose the same player-visible key set;
- interpolation parameter schemas must match across locales;
- missing player translations fail the local quality gate.

Runtime fallback is defensive only:

```text
active locale -> en -> visible missing-key marker in development
```

Fallback must not be used to make Chinese users default to English. A Chinese
browser/system candidate with no manual override resolves to `zh-CN`; if a
covered player key falls back to English, the missing-key counter and tests must
fail before acceptance.

Production player builds should not rely on missing-key markers. Development
and test builds should make missing keys visually obvious and record structured
local diagnostics such as key id, requested locale, fallback locale and surface.
These diagnostics stay local and are not telemetry.

Pseudo-localization is recommended for WM-0118 and WM-0120 layout evidence.
The pseudo generator should derive from `en`, expand strings, preserve named
parameters and expose overflow risks. Pseudo output is a test surface, not a
translation resource required for product support.

## Diagnostics And English Isolation

Developer diagnostics may stay English-only for M8 when all of these are true:

- the surface is hidden from the default player launch;
- access requires dev mode, an explicit diagnostics command or a test harness;
- the string keys are under `dev.*` or an equivalent debug-only namespace;
- responsive and product UI tests assert the default player flow does not show
  internal harness labels such as diagnostic panel titles;
- the report for the owning task lists which diagnostics remain English-only.

English-only diagnostics cannot be used for first-play guidance, settings,
main menu, HUD, alerts, player-visible reason text, accessibility labels or
public-facing claims.

## Downstream Test Strategy

WM-0114, localization infrastructure:

- unit tests for locale normalization, Chinese detection, manual override
  precedence, corrupt preference recovery and fallback order;
- storage tests for Web and Windows preference scope without save schema writes;
- missing-key/completeness validation that fails `pnpm quality`;
- Web and desktop e2e proving `zh-CN` default for Chinese candidates, `en`
  default for non-Chinese candidates and manual persistence after reload;
- Electron preload audit if any locale or preference bridge is added.

WM-0115, translation resources:

- hardcoded player-string inventory that separates player UI from `dev.*`
  diagnostics;
- validation that `zh-CN` and `en` resources cover every current
  player-visible key;
- Chinese default UI evidence showing no covered English player text;
- explicit report of English-only diagnostics that remain isolated.

WM-0116, main menu settings:

- default launch is a player-facing main/start surface, not a diagnostics
  harness;
- language selector updates visible UI without Simulation Worker mutation;
- New Game, Continue, Settings and accessibility labels are localized;
- manual override persists across Web reload and Windows app restart evidence.

WM-0118, responsive viewport validation:

- run required viewport checks in both `zh-CN` and `en`;
- include pseudo-localization or equivalent long-text stress when practical;
- inspect for clipping, incoherent overlap, missing key information, unreachable
  scroll regions and raw missing-key markers;
- store screenshot or DOM-layout artifacts for reviewer inspection.

WM-0120, accessibility readability:

- validate readability, contrast, scroll regions, keyboard/mouse basics and
  non-color-only status in both player locales;
- test UI scale or font-scale behavior against longer English labels and dense
  Chinese strings;
- ensure language switching does not reset simulation state, save state,
  selected scenario or authoritative Worker session.

## Block Conditions

Downstream work must block for architecture review if it needs any of these:

- adding localization state to `sim-core`, `sim-worker`, `sim-protocol` or save
  sections;
- changing public Worker protocol solely to move localized text;
- adding broad Electron APIs or host filesystem access for language settings;
- adding telemetry, accounts, cloud sync, hosted feedback or public privacy
  claims for locale preferences;
- shipping a player-visible English-only default UI for Chinese system/browser
  candidates;
- accepting missing player-visible translations as warnings instead of failed
  gates;
- treating pseudo-localization as a supported player locale.
