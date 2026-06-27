# M8 1.0 Content And Endgame Scope Contract

Status: WM-0121 gameplay-design contract. This document defines 1.0 content
scope and downstream validation expectations only. It does not implement
runtime content, change schemas, approve public release, approve store
submission, or create public save-compatibility promises.

Values marked **provisional balance** are acceptance starting points for M8
implementation and may move only through focused downstream evidence. Roster
entries marked **provisional canon** are approved targets for 1.0 content
authoring, not final shipped lore until their data, localization, scenario and
cultural review gates pass.

## Authority Boundaries

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- React, Pixi, Electron, Web and UI surfaces consume read models and issue
  explicit player commands only.
- Content definitions are inputs. Mutable anomaly, faction, obligation,
  Chronicle, town-rule, director and save facts remain owner-store state.
- M8 content work must use data-driven definitions, reusable rule components,
  localization keys, structured reasons and scenario fixtures.
- WM-0121 changes no runtime content, data schema, package API, save container,
  Worker protocol, app code, tool code or platform/release surface.

## 1.0 Readiness Is Not Release Approval

M8 1.0 readiness means the internal 1.0 content set, endgame routes, data-mod
workflow, long-save evidence, localization evidence and regression matrix are
ready for owner review.

M8 1.0 readiness does not approve:

- public release;
- Early Access launch;
- store submission, store publication, signing, installer, updater or Steam
  package;
- telemetry, analytics, account services, hosted feedback, crash upload, paid
  services or public support workflow;
- final privacy, legal, cultural, historical, medical, spiritual, store or
  marketing claims;
- public Web launch or a change to the Web `demo-only` verdict;
- Windows public release or a change to the unsigned controlled-test verdict;
- public save compatibility, cross-version migration guarantee, Windows/Web
  save interop claim, cloud save, hosted save or collection of full tester save
  files.

Any item above requires explicit owner approval and a reviewed task packet.

## Preserved Baselines

M8 must preserve the M0-M7 technical and product baselines unless a later
reviewed migration explicitly accepts a change:

- M5 scenario: `m5.alpha_content_framework.first_season.v1`.
- Headless alias: `m5-alpha-content-framework`.
- Requested seed: `5`.
- Authoritative seed: `155`.
- Command stream hash: `0x81d37435`.
- Content manifest hash: `0xe55d3015`.
- Final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.
- Benchmark warning/blocking thresholds: 10 percent warning and 20 percent
  blocking regression.
- Web verdict: `demo-only`.
- Windows verdict: unsigned local-directory
  `ready-for-controlled-external-test`.
- M8 UI/i18n gates from WM-0111 and WM-0112 remain required, including
  player-facing default UI, zh-CN/en localization, responsive viewports,
  accessibility, first-play guidance and debug separation.

## Scope Summary

M8 content readiness requires all of the following:

1. A 12 to 15 anomaly roster with at least 12 fully validated anomalies and up
   to 3 stretch anomalies accepted only if they pass the same gates.
2. Full faction and endgame arcs that route through owner facts, not hidden
   faction mood or prose-only story states.
3. A stable data-mod workflow for official 1.0 content and controlled local
   data mods, with fail-closed validation and localization coverage.
4. Long-save stability evidence for the 1.0 content set, without public
   cross-version compatibility promises.
5. zh-CN and en localization completeness for player-visible M8 content,
   including scenario, Chronicle, obligation, faction and endgame copy.
6. A downstream validation matrix that proves clues, counterevidence,
   noncombat resolution, social consequences and explainability for the
   content set.

## Anomaly Roster Target

**Provisional balance:** M8 should ship readiness with 12 accepted anomalies.
The authoring cap is 15. Extra entries beyond 12 are stretch scope and must not
weaken validation depth, localization or performance evidence.

Every accepted anomaly must satisfy the existing authoring rules:

- affects at least three systems;
- has at least four evidence classes;
- includes at least one plausible misread and explicit counterevidence;
- includes at least one noncombat resolution;
- includes a social consequence or obligation consequence;
- exposes accident/dawn review facts from owner stores;
- uses reusable rule components and `contentBudget.bespokeRuntimeComponents: 0`
  unless a separate reviewed implementation task approves a new owner surface;
- has localized zh-CN and en player-visible strings;
- has a focused headless scenario or scenario branch and an integrated content
  matrix row.

### Required Baseline Entries

These three are already the M5 alpha baseline and remain required:

| Anomaly | Scope role | Required preservation |
| --- | --- | --- |
| Borrowed Shadow | Identity rule and lamp-gap/Chronicle proof. | Lamp gap, Chronicle identity evidence, obligations, town rules, noncombat containment and accident review must remain data-driven. |
| Third Knock | Threshold invitation and temporary-policy proof. | Prior-knock evidence, witness disagreement, threshold marks, obligation pressure, guesthouse policy and noncombat containment must remain explicit. |
| Old Bridge Guest | Reciprocity logistics and bridge-route proof. | Prepared item for another actor, bridge ledger, route/logistics basis, obligation pressure, faction pressure and noncombat settlement must remain explicit. |

### Required New 1.0 Entries

These nine entries are **provisional canon** targets for WM-0122. Names may be
localized or refined during content review, but each row's systemic role is
part of the 1.0 contract.

| Anomaly | Core rule | Required systems | Evidence and counterevidence | Noncombat and social consequence |
| --- | --- | --- | --- | --- |
| Well Below Cry | The unsafe water order is caused by who draws first after an unrecorded death, not by the red lamp players may blame. | Water logistics, Chronicle, health, town ordinance, obligations. | Rope wear, water turbidity, witness order, old death note; counterevidence that red-lamp nights without the draw order do not trigger it. | Reorder water duty, record the dead, close the well temporarily; may create resentment over water rationing and burial duty. |
| Return-Lamp Keeper | It repairs unclaimed lamps but takes a memory or name-fragment as payment when no keeper obligation exists. | Lamp network, memory/mood, obligations, Chronicle, resident identity. | Repaired wick, missing maintenance record, memory gap testimony, lamp soot pattern; counterevidence that assigned keeper routes prevent payment. | Assign keeper, settle payment openly, refuse service and repair manually; may damage trust if memory loss is hidden. |
| Doorless Room | It appears in rooms no family, guesthouse or ordinance recognizes as belonging to anyone. | Rooms/housing, identity registry, town ordinances, construction, social graph. | Floor-plan mismatch, sleep assignment gap, repeated room-number testimony, dust boundary; counterevidence that a recognized temporary shelter closes it. | Recognize occupancy, convert to public shelter, seal room with cost; may trigger housing legitimacy disputes. |
| Name Counter | Public counting of unnamed people lets it approach the counted group. | Roster, Chronicle, faction registration, ordinances, panic/social trust. | Count tally, roster deletion, crowd testimony, repeated footsteps; counterevidence that named witness lists do not attract it. | Replace public counts with witness-backed name lists, negotiate with Registry Office; may anger factions demanding fast census data. |
| Dream-Borrowing Child | It finds hidden dead through children's dreams and asks the town to finish the abandoned duty. | Family, burial/Return-Lamp Society, Chronicle, health/rest, obligations. | Child dream details, matching burial trace, family denial, old debt token; counterevidence that unrelated dreams lack source anchors. | Complete burial, create supervised dream protocol, negotiate rest protection; may split families over concealed deaths. |
| Ash Register | Burned records reappear as ash copies that preserve one fact and invert one relationship. | Archive, Chronicle contradictions, fire risk, identity registry, factions. | Ash script, heat pattern, mismatched relation row, copied seal; counterevidence from unburned duplicate archive. | Preserve redundant archives, quarantine ash copies, publish contradiction; may produce legal conflict over which record is accepted. |
| No-Guest Cart | A cart at the road accepts goods only if no one claims to be its owner, then delivers to the person most owed. | Logistics, obligations, faction trade, guest policy, Chronicle. | Ownerless cart track, delivery witness, debt ledger match, missing claim statement; counterevidence when claimed goods fail delivery. | Use escrow rules, refuse unknown freight, settle debt before loading; may commercialize debts through Nine Inns pressure. |
| Boundary Moth | It eats the social claim around lamps, not the flame, when residents stop sharing keeper duties. | Lamp network, work scheduling, mood/social trust, ordinances, director recovery. | Flame intact but claim weak, duty roster gap, moth wing dust, keeper conflict testimony; counterevidence that shared duty rotations repel it. | Rotate duties, repair social trust, reduce overcentralized keeper authority; may expose unfair labor burdens. |
| Paper Rain | Unfiled promises fall as blank slips that become binding when residents write names on them during panic. | Obligations, Chronicle, weather, town ordinances, faction contracts. | Blank slips, ink absorption, panic testimony, obligation echo; counterevidence that dated witness notes remain ordinary paper. | Ban emergency signing, create witness protocol, collect slips without names; may block legitimate urgent contracts. |

### Stretch Entries

These three are **provisional canon stretch**. They may be cut from 1.0
readiness without blocking M8 if 12 accepted anomalies already pass.

| Anomaly | Core rule | Required systems | Acceptance note |
| --- | --- | --- | --- |
| Market Scale | It balances trades by forgotten favors rather than item value. | Night market, obligations, economy, Chronicle. | Must not become a hidden barter bonus; every trade needs visible terms and breach consequences. |
| River Mirror Clerk | It records only identities reflected in moving water and rejects still-water names. | River route, registry, Chronicle, faction legal pressure. | Needs strong counterevidence so players can distinguish water rule from ordinary forgery. |
| Last Watch Bell | It rings for the person who should have been on watch, not the person assigned. | Night watch, town ordinance, social trust, lamp boundary. | Must support noncombat resolution through duty audit and social repair. |

## Faction Arcs

M8 faction arcs must use decomposed owner facts such as legal stance, trade
stance, debt stance, legitimacy, fear/memory, known claims, obligations,
Chronicle versions and governance hooks. A single hidden reputation bar or
prose-only diplomacy state is not acceptable.

Each faction arc must contain:

- at least one resource or capability it uniquely offers;
- at least one long-term constraint or obligation it imposes;
- at least one internal contradiction;
- a noncombat negotiation or compromise route;
- a failure route with visible social consequences;
- faction-specific evidence and counterevidence surfaced in Chronicle,
  obligations, ordinances or dawn/season review;
- localization coverage for event, review and management text.

Required 1.0 faction arcs:

| Faction | 1.0 arc | Required systemic conflict |
| --- | --- | --- |
| Registry Office | Rebuild legal identity and road authority after the lost records. | Legal recognition can protect residents but may censor dangerous Chronicle knowledge or reject anomalous identities. |
| Nine Inns Guild | Turn road safety, guesthouses, lamp oil and paper supply into commercial leverage. | Trade stability may monetize old debts and pressure the town to treat obligations as transferable assets. |
| Mountain Contract Families | Preserve local land-use obligations and oral history while old family conflicts resurface. | Local knowledge helps solve anomalies but can enforce inherited debts and competing ancestral claims. |
| Night Market Guests | Offer precise contracts, anomaly materials and identity-recognition services. | Contract clarity can solve crises but creates debt terms that outlive the immediate benefit. |
| Return-Lamp Society | Protect burial, name preservation and survivor trust. | Memorial duties stabilize the town but can oppose anonymous efficiency, forced migration or secret-keeping routes. |
| Town Council Posts | Convert repeated choices into offices, temporary policies and formal ordinances. | Governance improves automation but can become coercive, corrupt or brittle when evidence changes. |

## Endgame Arcs

M8 endgame eligibility must be derived from accumulated owner facts: lamp
boundary state, Chronicle confirmed and contradicted knowledge, obligation
ledger state, faction/governance hooks, town ordinances, social trust, resident
losses and content scenario outcomes.

Endings are not buttons. A route can be presented only when the scenario matrix
can explain why it is available, blocked or socially contested.

| Ending route | Required support | Required cost or opposition | Validation scenario |
| --- | --- | --- | --- |
| Human Town | Strong lamp boundaries, public Chronicle, limited anomaly contracts, reliable night watch and enough ordinary production. | High labor/resource cost, faction pressure from Night Market, and risk of rejecting anomalous residents. | A late-season route where the town cuts one contract without erasing existing obligations. |
| Cohabitation Town | Recognized anomalous identities, contract law, housing/roster adaptation and strong contradiction handling. | Registry Office opposition, inheritance disputes and higher obligation complexity. | A route where split or nonhuman identity is legally recognized with consequences. |
| Secret-Keeping Town | Stable old pact, controlled knowledge dissemination and sacrifice/keeper obligations. | Trust loss, censorship risk and inherited hidden costs. | A route where public safety improves while Chronicle access narrows, with resident dissent. |
| Unlit Town | Willing reduction of fixed human boundary in favor of market/border coexistence. | Logistics instability, safety fear, faction trade shifts and changed housing rules. | A route where a lamp boundary is deliberately removed under explicit conditions, not by neglect. |
| Migration | Organized evacuation with selected people, records, debts and dangerous knowledge. | Loss of land, unresolved debts, faction pursuit and choice of who or what is left behind. | A route where carried records and obligations affect post-town outcome. |

Each endgame scenario must include clues, counterevidence, at least one
noncombat path, social consequences and an explainable blocked-path state.

## Stable Data-Mod Workflow

M8 uses the existing data-only content direction:

```text
JSON5 / CSV / localization
-> schema validation
-> mod dependency and patch validation
-> reference resolution
-> semantic validation
-> localization coverage
-> deterministic compile order
-> immutable catalog
-> content manifest hash
-> scenario validation
-> Simulation Worker / Node headless
```

Stable workflow requirements for WM-0124:

- untrusted external data enters as `unknown` and fails closed;
- no arbitrary JavaScript, Node API, dynamic network request, executable
  script, install-time effect, code mod, platform API mod or remote URL;
- deterministic DefIndex order and content manifest hash;
- path safety and size caps;
- schema, reference, semantic, localization and scenario validation counters;
- rejected fixtures for unsafe paths, missing localization, missing evidence,
  invalid faction/governance lanes, invalid event cooldowns and owner-surface
  mismatch;
- compiled definitions remain immutable inputs and never mutate owner stores
  directly;
- missing Defs in saves must report structured impact and preserve identities
  through explicit placeholders when allowed by the existing save policy.

WM-0121 does not approve new schema kinds. If WM-0122, WM-0123 or WM-0124
needs a schema change, that downstream task must block or request a separate
reviewed schema task.

## Long-Save Targets

Long-save evidence is internal 1.0 readiness evidence only. It is not public
cross-version compatibility.

Required WM-0125 targets:

- same build, same content hash, same command stream and same seed reproduce
  deterministic checkpoint hashes;
- save/load/resume compares against uninterrupted replay after every accepted
  content-season checkpoint;
- derived indexes, path caches, WorkOffer rows, read models and UI projections
  rebuild from owner stores and are not authoritative save payloads;
- content manifest hash and Def dictionary identity are recorded and validated;
- missing or changed content produces structured errors or explicit placeholder
  impact reports instead of silent deletion;
- no save test claims public compatibility, cross-version migration, Windows/Web
  interop or public player-save support.

**Provisional balance:** WM-0125 should include:

- at least one integrated 1.0 content-season scenario through `100000` ticks to
  protect the M5 long-run baseline style;
- at least one longer soak through `1080000` ticks, equal to 30 game days at
  30 TPS and `36000` ticks/day, or a reviewer-accepted equivalent if runtime
  cost requires splitting by deterministic checkpoints;
- save at a named checkpoint before and after a major faction/endgame branch,
  load at the next tick, and compare to uninterrupted replay through the next
  checkpoint.

Any public migration policy remains owner-gated.

## Localization Targets

M8 localization readiness depends on WM-0113 through WM-0115 and must cover all
player-visible M8 content:

- support at least `zh-CN` and `en`;
- Chinese browser/system language defaults to `zh-CN`; non-Chinese defaults to
  `en`; settings allow manual override;
- player-visible strings use localization keys;
- missing translations fail tests;
- developer diagnostics may remain English only when isolated from default
  player UI;
- localized text must cover anomaly names, evidence states, counterevidence,
  Chronicle entries, obligations, town ordinances, faction events, endgame
  route status, accident/dawn review rows, data-mod validation errors and
  blocked-action explanations;
- terminology must preserve M7 cultural review limits and must not claim real
  folklore, real history, religious practice, legal advice, medical advice or
  spiritual truth.

## Downstream Contracts

### WM-0122 Anomaly Roster And Content Expansion

WM-0122 should implement data content only within approved content/schema
surfaces.

Acceptance expectations:

- 12 accepted anomaly definitions minimum, 15 maximum;
- every accepted anomaly has four evidence classes, counterevidence,
  `commonMisread`, noncombat resolution, accident-review keys and at least
  three affected systems;
- every accepted anomaly has focused scenario evidence for prevention,
  misread/failure and noncombat resolution;
- no anomaly resolves through combat-only handling, prose-only event text,
  arbitrary stat bonuses, hidden faction deltas or bespoke UI/AI/runtime code;
- rejected fixtures prove fail-closed behavior for missing evidence,
  missing localization, invalid references and unsafe content.

### WM-0123 Faction And Endgame Integration

WM-0123 should integrate faction and endgame arcs through existing or
separately approved owner stores.

Acceptance expectations:

- each required faction has decomposed facts, resources, constraints, internal
  contradiction, noncombat route and failure consequence;
- endgame route availability and blocked states are derived from owner facts;
- scenarios prove at least one path toward each of the five endgame routes;
- Chronicle, obligations and ordinances explain why routes are open or blocked;
- no monolithic diplomacy mood, UI-owned ending flag or prose-only epilogue
  substitutes for scenario facts.

WM-0123 implementation note:

- `M8FactionEndgameStore` records six required faction arcs as decomposed
  resource, constraint, contradiction, negotiation, failure and explanation
  masks with faction, governance, Chronicle, obligation and ordinance owner
  versions.
- The route state machine derives Human Town, Cohabitation Town,
  Secret-Keeping Town, Unlit Town and Migration eligibility from bounded route
  rows and returns structured available, blocked or contested reasons.
- `runM8FactionEndgameScenario()` is headless-only evidence. It composes M5
  faction/governance owner facts with M8 route rows, records deterministic
  replay hash equality and performance counters, and does not modify the
  protected `m5-alpha-content-framework` fixture or hashes.

### WM-0124 Data-Mod Workflow And Localization Completeness

WM-0124 should harden the content workflow and localization gates.

Acceptance expectations:

- deterministic compile order and manifest hash;
- schema/reference/semantic/localization/scenario validation counters;
- fail-closed rejected fixtures;
- zh-CN/en coverage for all accepted 1.0 content;
- missing translations fail tests;
- code mods, network mods, executable scripts and platform API mods remain
  forbidden.

### WM-0125 Long-Save Stability And Migration Gate

WM-0125 should prove internal long-save stability without public promises.

Acceptance expectations:

- content manifest identity is validated on load;
- save/load/resume matches uninterrupted replay for accepted checkpoints;
- long-run soak covers integrated content, faction and endgame pressure;
- missing content and incompatible content report structured errors;
- no public cross-version compatibility, Windows/Web interop or migration
  guarantee is claimed.

### WM-0126 Performance, Regression And Readiness Matrix

WM-0126 should consolidate the M8 evidence.

Acceptance expectations:

- M0-M7 baselines and 10/20 percent benchmark thresholds are preserved or a
  reviewed migration explains accepted movement;
- responsive/i18n/accessibility evidence from WM-0118/WM-0120 is included;
- anomaly/faction/endgame/content-mod/long-save scenarios are listed with
  hashes, seeds, content hash and structured reason coverage;
- performance metrics include candidate caps, Top-K reads, queue/backlog
  stability, Worker projection bytes and save/load rebuild timing;
- owner gates and release no-go confirmations are repeated.

## Review Checklist

The M8 content/endgame closeout reviewer should reject downstream work if any
of the following is true:

- fewer than 12 anomalies pass validation;
- an anomaly lacks clues, counterevidence, noncombat handling, social
  consequences or explainable accident review;
- a faction or ending depends on hidden mood, UI state, prose-only story flags
  or arbitrary bonuses;
- content data bypasses validation or requires unapproved code/schema changes;
- localization coverage is incomplete for player-visible M8 content;
- long-save evidence is described as public compatibility;
- Web, Windows, release, store, signing, telemetry, accounts, paid services,
  public feedback, legal/privacy or save-compatibility owner gates are
  weakened;
- M0-M7 baseline hashes or benchmark thresholds move without reviewed evidence.
