# M5 Alpha Content Framework Plan

Status: planning package created by WM-0072. Runtime M5 implementation remains
unstarted until WM-0072 is independently reviewed and integrated. M6 remains
unstarted and must not be created, promoted, claimed or implemented by this
package.

## Objective

M5 proves that Wuming Town can expand from one reviewed M4 rule-discovery
vertical slice into an alpha content framework. The goal is not raw content
volume. The goal is repeatable content production through data, reusable rule
components, owner stores, validation, focused save/replay, Worker projections
and benchmarked invariants.

The closeout target is concrete:

- Scenario id `m5.alpha_content_framework.first_season.v1`.
- Three anomaly rules are present and testable:
  `core.anomaly.borrowed_shadow.v1`, `core.anomaly.third_knock.v1`, and
  `core.anomaly.old_bridge_guest.v1`.
- Faction and governance hooks affect event legality and strategy pressure
  through owner facts, not prose-only mood or UI-owned diplomacy.
- A first-season event pool produces bounded incidents, cooldowns, recovery
  opportunities and structured rejections.
- Data mods fail closed before runtime when schema, references, semantics,
  localization, path safety or size checks fail.
- M0-M4 regression protection and benchmark thresholds remain unchanged.
- M6 readiness is reported as stop signs only.

## Non-Negotiable Boundaries

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React, Electron, overlays and read-model consumers are read-only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- Content definitions compile to stable ids and hashes; runtime owner stores
  own mutable facts.
- Actor, anomaly, faction, governance, incident and director choices use
  bounded indexed candidates and stable Top-K ordering.
- Job and crisis progress are explicit serializable state machines.
- Key failures produce structured reasons and bounded trace rows.
- Normal ticks do not allocate per entity, content def, anomaly, faction fact,
  event candidate or projection row.
- Public Worker protocol, public save compatibility, schema migrations outside
  owning tasks, package-boundary changes, dependencies, platform save UI,
  product packaging and M6 work remain blocked unless separately reviewed.

## Scope

Included:

- Data-only content schema and validation path for M5 alpha content packs.
- Anomaly roster framework for borrowed shadow, third knock and old bridge
  guest.
- Faction and governance owner facts for strategy hooks.
- First-season event pool and director composition.
- Alpha content catalog expectations for buildings, tags, localization and
  validation fixtures.
- Integrated M5 scenario, focused save/replay, Worker projection parity,
  benchmarks, invariants and M6 readiness stop-sign evidence.

Excluded:

- M6 platform/product gate, Web/Windows packaging, external playtest, crash
  reports, accessibility closeout and storefront work.
- Public save compatibility, platform save UI, public Worker protocol redesign,
  codec dependencies or cross-version save promises.
- Arbitrary code mods, network mods, executable scripts and platform API mods.
- Full faction campaign, election simulator, broad diplomacy UI, broad combat,
  new region expansion or procedural content factory.
- UI-authoritative tools or client-side simulation repair.

## Current M4 Baseline

M4 closed with reviewed evidence:

- M4 scenario id `m4.core_vertical_slice.borrowed_shadow_lamps.v1`
- alias `m4-core-vertical-slice`
- requested seed `4`
- authoritative scenario seed `50`
- content hash `0x698f2c41`
- command stream hash `0x538d0e43`
- 36000-tick final world hash `0xc201a925`
- 36000-tick scenario read-model hash `0xce261d9d`
- 100000-tick final world hash `0xdafa3b25`
- 100000-tick scenario read-model hash `0xa896439d`
- M4 benchmark final world/read-model hashes:
  `0xdafa3b25` / `0x08dd9343`
- focused save tick/load tick `12000` / `12001`
- focused save first divergent tick `null`
- Worker parity first mismatched checkpoint tick `null`
- reviewed benchmark artifact
  `coordination/artifacts/WM-0070/benchmarks/benchmark-results.json`
- reviewed benchmark artifact SHA-256
  `FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`

M5 implementation must compose this baseline. Any M0-M4 regression blocks M5
closeout unless a separate reviewed task explains and accepts the change.

## Architecture Gate

`coordination/decisions/ADR-0010.md` is the M5 architecture gate. Downstream
tasks must cite it and block rather than code through:

- owner-store gaps;
- normal-tick global scans;
- hidden shared state or unversioned caches;
- UI authority;
- direct director mutation of facts;
- unsafe or executable mod content;
- public Worker protocol, public save/schema, package-boundary, dependency or
  M6 needs.

## DAG

```text
WM-0072 M5 planning package
  -> WM-0073 content schema and data-mod validation gate
      -> WM-0074 anomaly roster and borrowed-shadow data lift
          -> WM-0075 third-knock anomaly rule
              -> WM-0076 old-bridge guest anomaly rule
                  -> WM-0077 faction and governance hooks
                      -> WM-0078 first-season event pool
                          -> WM-0079 alpha content catalog
                              -> WM-0080 integrated M5 alpha scenario
                                  -> WM-0081 M5 focused save/replay
                                      -> WM-0082 M5 Worker projections and parity
                                          -> WM-0083 M5 benchmarks, invariants and M6 stop signs
```

The graph is acyclic. `WM-0073` depends on reviewed integration of WM-0072.
No runtime M5 implementation starts inside WM-0072.

## Safe Concurrency

The first M5 chain is mostly serial because schema/validation and owner stores
define the content surfaces consumed by later tasks. The project-director may
split read-only review or research in parallel. Write tasks should not overlap
until owning stores, schema versions and public exports are stable. `reviewer`
remains read-only.

`rapid-implementer` is not appropriate for the planned M5 tasks because they
touch architecture, content schema, deterministic simulation ownership,
save/replay, Worker projections, benchmarks or milestone readiness. A later
tiny data fixture or documentation repair may be split only if it gets its own
task and satisfies the Spark classifier.

## Task Packet Field Contract

Each M5 task JSON includes:

- `objective`
- `milestone`
- `allowedPaths`
- `forbiddenPaths`
- `dependsOn`
- `ownerRole`
- `reviewerRole`
- `acceptance`
- `requiredChecks`
- `risksAndFileOwnership`
- `benchmarkImpact`
- `reviewRouting`
- `rollbackModel`
- `ownerGate`
- `sparkEligibility`

Task JSON files are the durable dispatch authority. Summaries below mirror the
packet intent.

## Task Packets

### WM-0073 - Add M5 Content Schema And Data-Mod Validation Gate

- Owner: `systems-architect`
- Reviewer: `reviewer`
- Dependencies: `WM-0072`
- Objective: implement the first M5 content validation gate and schema policy
  for anomaly roster, faction/governance hooks, season events and alpha catalog
  definitions.
- Acceptance focus: invalid content fails before runtime; code/network/platform
  mods remain forbidden; compile order and manifest hashes are deterministic.
- Benchmark impact: validation counters only; runtime baselines wait for
  WM-0083.

### WM-0074 - Add M5 Anomaly Roster And Borrowed-Shadow Data Lift

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0073`
- Objective: add the M5 anomaly roster owner surface and lift the M4 borrowed
  shadow rule into a rostered data-driven rule without changing its reviewed
  M4 behavior.
- Acceptance focus: roster rows are compiled inputs, mutable rule state remains
  owner-store state, and activation uses bounded versioned candidates.
- Benchmark impact: anomaly roster counts and activation candidate metrics.

### WM-0075 - Add Third-Knock Anomaly Rule

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0074`
- Objective: add `core.anomaly.third_knock.v1` with explicit threshold,
  invitation/debt, evidence, town-rule and non-combat resolution state.
- Acceptance focus: no Promise/coroutine progress, no UI authority, no global
  scans, and structured reasons for every activation/rejection path.
- Benchmark impact: third-knock transition and evidence counters.

### WM-0076 - Add Old-Bridge Guest Anomaly Rule

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0075`
- Objective: add `core.anomaly.old_bridge_guest.v1` using logistics, bridge
  route, prepared item, obligation, faction and season basis facts.
- Acceptance focus: prepared-item and route facts stay in existing owner
  stores; bridge anomaly state stores only explicit rule progress and basis
  versions.
- Benchmark impact: bridge candidate, route/prepared-item basis and terminal
  reason metrics.

### WM-0077 - Add Faction And Governance Hooks

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0076`
- Objective: add decomposed faction facts and governance hooks for event
  legality, policy pressure and strategy variation.
- Acceptance focus: facts are owner-store lanes, not prose mood; governance
  hooks cannot bypass Chronicle, obligations or town rules.
- Benchmark impact: faction/governance candidate and conflict counters.

### WM-0078 - Add First-Season Event Pool

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0077`
- Objective: add the bounded first-season event pool with cooldowns, recovery
  opportunities, anomaly/faction/governance hooks and legal command scheduling.
- Acceptance focus: the director schedules only legal commands and emits
  structured precondition/cooldown/recovery rejections.
- Benchmark impact: event candidate, cooldown, recovery and queue metrics.

### WM-0079 - Add Alpha Content Catalog And Validation Fixtures

- Owner: `content-worker`
- Reviewer: `reviewer`
- Dependencies: `WM-0078`
- Objective: add the first alpha content catalog definitions and validation
  fixtures for 20-30 buildings/tags/localization references without adding
  bespoke runtime code per item.
- Acceptance focus: content validates through the M5 schema path, maps to
  existing owner surfaces, and records design/culture/fairness review notes.
- Benchmark impact: validation artifact size and content count metrics only.

### WM-0080 - Integrate M5 Alpha Scenario

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0079`
- Objective: compose `m5.alpha_content_framework.first_season.v1` in headless
  runtime using the anomaly roster, faction/governance hooks, season events and
  content catalog.
- Acceptance focus: scenario runs deterministically, demonstrates multiple
  strategy paths, records hashes, and protects M0-M4 invariants.
- Benchmark impact: scenario metrics for save/replay, Worker parity and
  benchmark tasks without baseline updates.

WM-0080 implementation note: the headless scenario is now available as
`m5-alpha-content-framework` and records seed/hash evidence in
`coordination/artifacts/WM-0080/m5-alpha-scenario-summary.json`.

Recorded WM-0080 run:

- `requestedSeed`: `5`
- `authoritativeScenarioSeed`: `155`
- `finalTick`: `36000`
- `contentHash`: `0xe55d3015`
- `commandStreamHash`: `0x81d37435`
- `finalWorldHash`: `0x9a4a905c`
- `readModelHash`: `0x57eba2b7`

WM-0080 deliberately leaves save/replay, Worker parity, benchmark baselines and
M6 readiness as stop signs for WM-0081 through WM-0083.

### WM-0081 - Add M5 Focused Save/Replay

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0080`
- Objective: add focused save/load/resume diagnostics for the M5 scenario with
  content manifest hash and rebuilt M5 derived surfaces.
- Acceptance focus: owner-state snapshots validate before mutation; invalid or
  mismatched content fails closed; uninterrupted/resume hashes match.
- Benchmark impact: save bytes, load validation, rebuild time and divergence
  diagnostics.

### WM-0082 - Add M5 Worker Projections And Parity

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0081`
- Objective: prove Node Worker and browser Worker parity for M5 read-only
  projections and content/anomaly/faction/event basis metadata.
- Acceptance focus: projections remain read-only, stale basis is rejected, and
  public Worker protocol changes block for separate review.
- Benchmark impact: projection bytes, stale rejection counts and Worker parity
  diagnostics.

### WM-0083 - Add M5 Benchmarks, Invariants And M6 Stop Signs

- Owner: `qa-performance`
- Reviewer: `reviewer`
- Dependencies: `WM-0082`
- Objective: add M5 long-run benchmarks and invariant gates, then record M6
  readiness stop-sign evidence without creating M6 work.
- Acceptance focus: artifact-backed evidence covers content validation,
  anomaly roster, faction/governance hooks, season events, save/replay, Worker
  parity, M0-M4 regression and unchanged 10/20 thresholds.
- Benchmark impact: creates reviewed M5 benchmark artifacts and baseline
  changes only with explicit threshold preservation.

## Performance And Invariant Plan

M5 adds measurement surfaces without weakening existing thresholds. Every
benchmark comparison keeps the current policy: more than 10 percent P95
regression requires explanation, and more than 20 percent blocks merge by
default.

M5 invariant categories:

- M0-M4 regression: existing headless hashes, focused tests, save/replay,
  Worker parity and benchmark thresholds remain valid.
- Content validation: no unsafe mod input, schema mismatch, reference drift,
  localization miss or semantic error reaches runtime.
- Anomaly roster: no active-state leak, invalid transition, missing evidence
  class, unsupported bespoke code path or unbounded activation query.
- Faction/governance: no hidden authority, single-number mood collapse,
  policy bypass or unbounded fact scan.
- Season/event pool: no queue growth, cooldown bypass, direct fact mutation,
  recovery-window violation or hidden random draw.
- Save/replay and Worker: no divergent hash, stale projection acceptance,
  content-manifest mismatch, unrebuilt derived surface or UI repair path.
- M6 readiness: no M6 task creation and no implicit platform/release promise.

## Migration And Rollback Model

- Before implementation, rollback is reverting the WM-0072 planning files,
  ADR-0010, roadmap/project-state markers and proposed WM-0073 through WM-0083
  packets.
- Downstream implementation adds schema, owner stores and derived indexes
  incrementally. Derived content projections, Worker payloads and UI summaries
  rebuild from owner facts and compiled content basis.
- If a task discovers a need for public Worker protocol, public save/schema,
  dependency, package-boundary, UI authority, global scans, hidden shared
  state, executable mods, unsafe content or M6 work, it blocks and routes to
  systems-architect/project-director instead of coding through it.
- If M5 closeout cannot pass, the project remains in M5 and no M6 task is
  promoted.
