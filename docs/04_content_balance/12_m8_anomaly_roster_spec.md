# WM-0122 M8 Anomaly Roster Spec

Status: WM-0122 planning artifact. This document defines an independent M8
anomaly roster target and downstream validation expectations. It does not
modify runtime code, schemas, protected M5 fixtures, protected M5 hashes or
release surfaces.

## Purpose

WM-0122 cannot expand the protected M5 fixture set. This spec records the
intended M8 anomaly roster as a separate content target so downstream content
tasks can author or validate it without touching the protected M5 scenario.

The roster below is a planning target only. If a later task chooses different
names or splits an entry, the acceptance criteria still apply.

## Non-Goals

- No edits to `packages/sim-core/src/m5-alpha-content-scenario.test.ts`.
- No edits to `packages/sim-core/src/m5-invariants.test.ts`.
- No edits to `packages/sim-core/src/m5-save-replay.test.ts`.
- No edits to `packages/sim-core/src/m5-worker-projection.ts`.
- No edits to `packages/sim-worker/src/m5-worker-parity.test.ts`.
- No change to protected M5 hashes or content-manifest behavior.
- No bespoke runtime, Worker, save, UI, platform or network work.

## Accepted Roster Targets

These 12 anomaly targets are the WM-0122 acceptance set for M8 authoring.
Each target is expected to be data-driven, localized and validated through
scenario fixtures or content checks.

| Anomaly | Core rule | Required systems | Required evidence shape |
| --- | --- | --- | --- |
| Borrowed Shadow | Identity can split when lamp-gap and Chronicle evidence disagree. | Lamp, identity, Chronicle, obligation. | Lamp traces, witness reports, household record, medical note, counterevidence against false lamp blame. |
| Third Knock | The third response confirms a threshold invitation obligation. | Door, town rule, obligation, faction. | Knock counts, threshold marks, witness reports, lodging register, counterevidence against weather misread. |
| Old Bridge Guest | A bridge crossing is a reciprocity obligation, not a toll. | Route, storage, trade, obligation. | Bridge ledger, prepared bundle, merchant testimony, route delay, counterevidence against toll framing. |
| Well Below Cry | A hidden death changes water-draw order before the well turns unsafe. | Water, Chronicle, health, ordinance. | Rope wear, turbidity, draw order, burial note, counterevidence against red-lamp blame. |
| Return-Lamp Keeper | Unclaimed lamp repair can extract memory payment when no keeper duty exists. | Lamp, memory, obligation, identity. | Repaired wick, maintenance gap, memory-gap testimony, soot trace, counterevidence against harmless repair framing. |
| Doorless Room | Unrecognized occupancy produces a room with no accepted door. | Housing, identity registry, ordinance, construction. | Floor-plan mismatch, sleep assignment gap, room-number testimony, dust boundary, counterevidence against empty-corner misread. |
| Name Counter | Public counting of unnamed residents can trigger social approach pressure. | Roster, Chronicle, registration, panic. | Count tallies, roster deletions, crowd testimony, repeated footsteps, counterevidence against harmless census framing. |
| Dream-Borrowing Child | Child dreams expose hidden burial duties the town has not finished. | Family, burial, Chronicle, rest. | Dream detail, burial trace, family denial, debt token, counterevidence against imagination-only framing. |
| Ash Register | Burned records reappear as ash copies with inverted relations. | Archive, Chronicle contradictions, identity registry, faction. | Ash script, heat pattern, relation mismatch, copied seal, counterevidence from redundant archives. |
| No-Guest Cart | Ownerless freight routes toward the person most owed. | Logistics, obligations, trade, guest policy. | Cart track, delivery witness, debt ledger, missing claim, counterevidence against ordinary freight framing. |
| Boundary Moth | Social claim erosion, not flame loss, is the real threat. | Lamp, work schedule, trust, ordinance. | Claim weakness, duty roster gap, moth dust, keeper conflict, counterevidence against flame-eating misread. |
| Paper Rain | Unfiled promises become binding when panic adds a written name. | Obligations, Chronicle, weather, ordinance. | Blank slips, ink absorption, panic testimony, obligation echo, counterevidence against harmless debris framing. |

## Stretch Targets

These three targets are stretch scope. They may be cut from the accepted set
without blocking WM-0122 if the 12 accepted anomalies are fully validated.

| Anomaly | Core rule | Acceptance note |
| --- | --- | --- |
| Market Scale | Trade balance follows remembered favors, not item value. | Must keep visible terms, visible breach consequences and no hidden barter bonus. |
| River Mirror Clerk | Registry only accepts identities reflected in moving water. | Must include strong counterevidence and a non-water false-positive path. |
| Last Watch Bell | The bell rings for the person who should have been on watch. | Must resolve through duty audit and social repair, not a single hidden flag. |

## Localization Coverage

Every accepted anomaly target must have at least:

- one `labelKey` and one `descriptionKey`;
- matching `en` and `zh-CN` strings for player-facing text;
- review or accident keys that stay localized through scenario and validation
  docs;
- no locale-only fallback that hides missing content in one language.

Recommended key family for each anomaly:

- `content.<id>.label`
- `content.<id>.description`
- `content.<id>.review`
- `content.<id>.counterevidence`
- `content.<id>.scenario`

The downstream implementation may add more keys, but it should not reduce this
minimum coverage.

## Scenario Fixture Expectations

Each accepted anomaly should have a focused fixture or scenario branch that can
be validated without bespoke runtime logic.

Required fixture expectations:

- one prevention or avoidance fixture;
- one common-misread fixture;
- one noncombat resolution fixture;
- one review or accident fixture;
- at least one structured counterevidence note;
- a stable reference to the anomaly ID in the fixture name or payload.

Recommended fixture naming pattern:

- `prevention.<anomaly-name>.<case>`
- `misread.<anomaly-name>.<case>`
- `noncombat.<anomaly-name>.<case>`
- `review.<anomaly-name>.<case>`

## Data-Mod Policy Alignment

M8 anomaly work must remain data-only unless a separate reviewed task approves
runtime work.

Allowed:

- schema-compliant JSON or JSON5 data;
- localized text bundles;
- validation fixtures and docs;
- reference-resolution and semantic-validation evidence;
- deterministic compile order inputs.

Forbidden in this task:

- runtime code changes;
- Worker protocol changes;
- save-format changes;
- UI/app/platform changes;
- network or remote content fetches;
- executable mod support or code mods.

## Validation Expectations

The accepted roster is not considered ready until the downstream evidence set
shows:

- schema-compliant anomaly definitions;
- localization coverage in `en` and `zh-CN`;
- no missing references, missing evidence or unsafe path failures;
- scenario fixtures for clue, misread, noncombat and review coverage;
- deterministic validation output and no protected M5 hash churn.

## Downstream Handoff

WM-0122 hands the roster target to WM-0123 and WM-0124 as follows:

- WM-0123 should turn the accepted roster into faction, governance and endgame
  arcs that stay explainable through owner facts.
- WM-0124 should prove the data-mod and validation workflow, including
  localization coverage and fail-closed rejection paths.

If later work needs to move beyond data-only content, the new work must be
split into a separate reviewed task rather than folded into this planning
artifact.

## Protected Baseline Reminder

The protected M5 baseline remains unchanged:

- content manifest hash `0xe55d3015`;
- command stream hash `0x81d37435`;
- final world hash `0xfba70a5c`;
- read-model hash `0x9ba83cb7`.

Any roster implementation that would change those values is out of scope for
WM-0122 and must be re-planned.
