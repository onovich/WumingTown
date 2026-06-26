# M5 Alpha Content Framework Scenario

Status: planning package created by WM-0072. Runtime M5 implementation remains
unstarted until WM-0072 is independently reviewed and integrated, and the
project-director promotes downstream tasks through taskctl.

## Scenario Identity

- Scenario id: `m5.alpha_content_framework.first_season.v1`
- Planned alias: `m5-alpha-content-framework`
- Requested seed: `5`
- Planned authoritative scenario seed: implementation must derive and record
  this through the existing deterministic scenario rules.
- Closeout horizon: at least one first-season arc with enough simulated time to
  detect structural deadlock, queue growth, content validation drift, save/load
  divergence, Worker projection mismatch and M0-M4 regression.
- Alpha content framework proof: new content can be added mainly through data
  and reusable rule components rather than bespoke runtime code per item.

## Player-Readable Path

The scenario starts from the reviewed M4 core vertical slice and broadens it
into one first-season content loop:

1. The town begins after the borrowed-shadow lesson. Lamps, Chronicle evidence,
   obligations, town rules, director recovery windows and dawn review are still
   active.
2. A validated alpha content pack contributes three anomaly rules, faction
   hooks, governance hooks, building definitions and season events. Invalid
   data fails before runtime.
3. The first season alternates ordinary logistics, faction pressure, town-rule
   choices, incidents and recovery windows.
4. The player can survive by prioritizing different strategies: evidence-first,
   lamp and patrol discipline, faction negotiation, or conservative governance.
5. Dawn and season reviews materialize structured facts used by tests:
   anomaly traces, evidence support, obligations, faction/governance decisions,
   incident preconditions, content validation results, save/replay basis and
   Worker projection hashes.

## Required Alpha Anomaly Rules

M5 must include at least these three reusable anomaly rules:

### Borrowed Shadow

- Def id: `core.anomaly.borrowed_shadow.v1`
- Taxonomy: borrowed-form / identity rule.
- Reuses M4 lamp gaps, Chronicle identity evidence, obligations, town rules,
  borrowed-shadow crisis state and director recovery windows.
- Alpha role: proves that the M4 vertical rule can become one data-rostered
  anomaly without losing owner-store authority.

### Third Knock

- Def id: `core.anomaly.third_knock.v1`
- Taxonomy: road guest / threshold invitation rule.
- Core rule: answering the third night knock without a known confirmed rule or
  explicit temporary policy creates an invitation/debt relationship.
- Required surfaces: doors/threshold tags, town-rule knowledge, Chronicle
  testimony, obligations, guesthouse policy, night-watch work offers, faction
  consequences and non-combat containment.
- Low-risk evidence: two prior knocks, witness disagreement, threshold marks,
  lodging register mismatch and obligation pressure.

### Old Bridge Guest

- Def id: `core.anomaly.old_bridge_guest.v1`
- Taxonomy: road guest / reciprocal logistics rule.
- Core rule: at month-end bridge crossings, safe passage requires a prepared
  item intended for another person, not a self-serving toll.
- Required surfaces: logistics, storage, route/bridge tags, faction trade
  pressure, obligations, Chronicle source records, season windows and event
  pool cooldowns.
- Low-risk evidence: bridge ledgers, missing prepared goods, repeated route
  delays, merchant testimony and old-family oral records.

Each rule must affect at least three systems, include non-combat resolution,
have at least four evidence classes, expose a plausible misread, and produce an
accident review using structured owner facts.

## Faction And Governance Hooks

M5 hooks faction and governance facts without implementing full campaign
politics:

- Patrol Registry Office: legal identity, registration pressure, medical/legal
  help, censorship risk and public roster legitimacy.
- Nine Inns Guild: lamp oil, paper, guesthouse network, trade safety, debt
  commercialization and bridge-route leverage.
- Mountain Contract Families: local knowledge, guides, herbs, old debts,
  land-use obligations and oral history evidence.
- Night Market Guests: contract services, anomaly materials, precise debt
  terms and identity-recognition conflicts.
- Return-Lamp Society: burial, name preservation, trust, death records and
  resistance to anonymous efficiency.
- Town council posts: lampkeeper, chronicler, medic, night-watch lead and
  temporary policy authorities.

Governance hooks are owner facts and policy inputs. They are not prose-only
faction mood, UI-owned diplomacy or a monolithic political director.

## Season And Event Pool Expectations

M5 introduces one first-season pool:

- Time windows derive from authoritative ticks and season constants.
- Events declare theme, pressure contribution, legal preconditions, warning
  signs, cooldown, recovery type, faction hooks, governance hooks, anomaly
  hooks, content def references and structured rejection reasons.
- Candidate selection uses bounded lanes and stable Top-K order.
- The director may schedule legal event/opportunity commands only. It cannot
  mutate source facts, erase evidence, forgive obligations, heal residents or
  rewrite anomaly state directly.
- The pool must include resource pressure, registration pressure, market night,
  bridge-route pressure, archive damage risk and recovery opportunities.

Season/event pools are not a live-service generator, unbounded quest queue or
license to bypass ordinary simulation systems.

## Data-Mod Validation Boundaries

M5 content is data-only:

- Content packs provide manifests, schema-versioned definitions, references,
  localization keys, balance tags, rule-component links and scenario fixtures.
- The pipeline performs path safety, size caps, schema validation, reference
  validation, semantic validation, localization coverage, deterministic compile
  order, scenario validation and review gates.
- External content is parsed as `unknown` and fails closed before mutating
  owner stores.
- Compiled definitions receive stable DefIndex order and content manifest
  hashes for replay, save and Worker projection basis.

Code mods, network mods, platform API mods, executable scripts, remote URLs and
install-time effects are out of scope.

## Included Systems

- Anomaly roster and rule-component definitions for the three alpha anomalies.
- Content schema and data-mod validation policy, implemented by downstream
  owner tasks only.
- Faction and governance fact hooks for strategy pressure and event legality.
- First-season event pool and incident/recovery composition.
- Alpha content catalog expectations for 20-30 buildings, reusable tags,
  references, localization and validation fixtures.
- Integrated M5 scenario, focused save/replay, Worker projections, benchmarks,
  invariants, M0-M4 regression protection and M6 readiness stop signs.

## Explicit Non-Goals

- No M6 task creation, promotion, claim, implementation or review.
- No platform packaging, public release gate, external playtest, crash report
  pipeline, accessibility closeout or storefront work.
- No public save compatibility promise, platform save UI, public Worker
  protocol redesign, codec dependency, package-boundary exception or new
  runtime dependency unless a separate reviewed gate approves it.
- No arbitrary code mods, script mods, network mods, platform API mods or
  executable content.
- No full faction campaign, election simulator, diplomacy UI, broad combat
  system, large-region expansion or procedural content factory.
- No UI authority. React, Pixi, Electron, overlays and read-model consumers may
  display M5 projections only.
- No full-map, all-entity, all-content, all-anomaly, all-faction, all-event or
  all-projection scans during normal ticks or actor thinking.
- No coroutine, Promise, closure, UI-local or thread-local anomaly/crisis/job
  progress.

## Authority And State Boundaries

Simulation Worker or Node headless remains the only authoritative writer.
Content definitions are inputs, not mutable world authority. M5 owner stores
must hold mutable anomaly, faction, governance, season/event and validation
facts. Derived indexes, content projections, Worker payloads, debug overlays,
ReasonTrace views, season reviews and UI panels rebuild from owner stores and
carry source versions.

## Required Evidence At M5 Closeout

- Deterministic headless run for
  `m5.alpha_content_framework.first_season.v1` with recorded seed, content
  hash, command stream hash, final world hash and final read-model hash.
- Three anomaly rules validated through shared rule components, structured
  evidence, non-combat handling and accident reviews.
- Faction/governance hooks affecting legal event candidates without becoming
  hidden authority.
- First-season event pool with bounded candidates, cooldowns, recovery windows
  and structured rejection reasons.
- Data-mod validation artifacts proving invalid content fails before runtime.
- Focused save/load/resume evidence with content manifest hash, rebuilt M5
  surfaces and no first divergent tick.
- Browser Worker and Node headless parity for read-only M5 projections.
- Benchmark artifact preserving 10 percent warning and 20 percent blocking
  thresholds and protecting M0-M4 regression.
- M6 readiness stop-sign report confirming whether M6 can be planned or must
  remain blocked.

## WM-0080 Integrated Scenario Evidence

WM-0080 implements the first headless alpha scenario under
`packages/sim-core/src/m5-alpha-content-scenario.ts` and exposes it through the
headless alias `m5-alpha-content-framework`.

Recorded run:

- Requested seed: `5`
- Authoritative scenario seed: `155`
- Tick horizon: `36000` at 30 TPS
- Content hash: `0xe55d3015`
- Command stream hash: `0x81d37435`
- Final world hash: `0x9a4a905c`
- Read-model hash: `0x57eba2b7`
- Artifact: `coordination/artifacts/WM-0080/m5-alpha-scenario-summary.json`

The scenario composes the WM-0079 alpha content catalog, M5 anomaly roster,
borrowed-shadow lift, third-knock rule, old-bridge guest rule,
faction/governance hooks and first-season event pool. It records four strategy
paths: evidence-first, lamp patrol, faction negotiation and conservative
governance.

Scope kept for downstream tasks:

- Save/replay implementation remains a WM-0081 stop sign.
- Worker projection/parity implementation remains a WM-0082 stop sign.
- Benchmark baseline updates and M6 readiness decisions remain WM-0083 stop
  signs.
