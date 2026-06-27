# M7 Early-Game Balance And Readability Package

Status: WM-0100 M7 preparation artifact after independent review. This package
records balance/readability evidence and downstream guidance only. It does not
change M5 content data, runtime behavior, deterministic hashes, save/replay
contracts, benchmark thresholds, Web/Windows product-gate verdicts or public
release commitments.

## Source Evidence

Primary deterministic evidence:

- Scenario id: `m5.alpha_content_framework.first_season.v1`
- Headless alias: `m5-alpha-content-framework`
- Requested seed: `5`
- Authoritative scenario seed: `155`
- Content manifest hash: `0xe55d3015`
- Command stream hash: `0x81d37435`
- Final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`
- Long-run horizon: `100000` ticks at 30 TPS

M5 content/balance surface:

- `30` accepted definitions.
- `20` catalog entries.
- `3` anomaly definitions: borrowed shadow, third knock, old bridge guest.
- `4` recorded strategy paths: evidence-first, lamp patrol, faction
  negotiation and conservative governance.
- `5` active incident candidates and `2` active recovery candidates in the
  first-season event pool.
- `5` event selections, `8` total season candidate visits, `5` precondition
  failures and `1` cooldown write in reviewed M5 evidence.
- Third knock and old bridge resolve without active crisis leakage in the
  100000-tick invariant gate.

M6 product-gate constraints to preserve:

- Web remains `demo-only`.
- Windows remains `ready-for-controlled-external-test` as an unsigned unpacked
  local directory build.
- Public release, Early Access launch, store submission, signing, telemetry,
  account services, paid services, public feedback systems and public save
  compatibility remain owner-gated.

## Early Resource Pressure

Current evidence is enough for controlled external-test readability, but not
enough for final balance claims.

Use M7 material to describe resource pressure as a first-season test focus:

- lamp oil and night-watch coverage pressure;
- registration/legal identity pressure;
- bridge-route and logistics pressure;
- archive damage and evidence-protection pressure;
- market-night opportunity and risk pressure.

Do not promise that every pressure path is fully balanced. The M5 evidence only
proves the current deterministic fixture can preserve invariants, resolve its
sample anomaly paths and avoid queue-style growth. It does not prove a final
economy, full campaign, all-player-strategy parity or public Early Access
readiness.

M7 first-run guidance should make one pressure visible at a time:

1. Show current pressure source.
2. Show available evidence or missing evidence.
3. Show why a recovery action is legal or blocked.
4. Show the consequence of ignoring the pressure.

## Night-Risk Cadence

Night should not read as constant combat or random punishment. M7 copy and
onboarding should preserve the existing daily-loop principle:

- many nights can be observation and preparation;
- low-pressure signs can occur before a plan-changing incident;
- major incidents need visible warnings, legal preconditions and recovery
  opportunities;
- night-watch, lamps, evidence and town rules are planning tools rather than
  hidden dice rolls.

M5 evidence includes third-knock and old-bridge paths with structured evidence,
preconditions, non-combat resolution and accident/review material. M7 should
surface those as learnable patterns, not as surprise-only horror beats.

## Event Frequency And Recovery

The reviewed first-season pool currently contains enough variation for M7
external-test instructions:

| Surface | Evidence | M7 interpretation |
| --- | --- | --- |
| Incident candidates | `5` active candidates | Enough to explain multiple pressure sources |
| Recovery candidates | `2` active candidates | Enough to demonstrate recovery windows |
| Event selections | `5` selections | Enough for first-season test notes, not final cadence |
| Preconditions | `5` recorded failures | Useful for explaining why events do or do not fire |
| Cooldown | `1` write | Evidence of repeat-pressure control, not final tuning |

Downstream tasks should not overstate these numbers. They are regression and
readability evidence for the current fixture, not a final event-frequency
target for all content.

Recovery language should be concrete:

- "blocked because the required pressure is not present";
- "blocked because the recovery type does not match the active window";
- "available because the current evidence supports this action";
- "available but has secondary cost or obligation risk."

## Failure And Structured Reasons

For M7 testers, failure should be readable even when it remains painful.

Required readable failure classes:

- resource pressure is active or missing;
- legal/registration pressure blocks or permits a choice;
- known rule evidence is insufficient;
- night-watch or lamp coverage is insufficient;
- recovery window is absent, expired or wrong type;
- faction/governance risk blocks a policy;
- save/import failures use structured reasons and do not imply public
  compatibility.

The player-facing surface may localize and simplify wording, but the underlying
task/report language must keep source evidence and reason classes visible.

## Player Understanding Risks

Highest M7 readability risks:

- The first external player may see too many named systems at once: anomaly,
  faction, governance, season event, town rule, Chronicle, lamp, obligation and
  save/export/import surfaces.
- Web is `demo-only`; players may mistake Web shell support for same-spec
  browser gameplay.
- Windows is controlled-test-only; testers may mistake it for signed installer
  or public release readiness.
- Save compatibility is draft-only; Web import/export may be mistaken for a
  long-term public save promise.
- Cultural terminology must remain fictionalized and reviewed before
  public-facing copy.
- The task packet references a missing `docs/01_design/03_player_experience.md`
  path; current sources are `docs/01_design/02_player_journey_and_story.md`,
  `docs/01_design/03_daily_loop_and_pacing.md` and
  `docs/01_design/05_ui_ux_information_design.md`.

## Recommendations For Downstream M7 Tasks

WM-0099 onboarding:

- Introduce controls, time, saving and diagnostics before naming all systems.
- Teach one pressure and one recovery loop before exposing all M5 surfaces.
- Use explanation text for blocked choices and structured failure reasons.
- Keep UI/read models as consumers only; do not make UI authoritative.

WM-0106 store/playtest material:

- Say "controlled external test" and "readability/balance feedback wanted".
- Do not claim final balance, full release, Web same-spec, public save
  compatibility or finished EA launch readiness.
- Use four strategy paths as test invitations, not as a guarantee that every
  strategy is equally tuned.

WM-0107 known issues/release notes:

- Cite Web `demo-only`, Windows controlled-test-only, save compatibility draft
  and M7 balance-not-final status.
- Tell testers that event cadence and early pressure are under evaluation.

WM-0108 tester protocol:

- Ask testers to record when pressure became understandable.
- Ask whether blocked choices explained why they were blocked.
- Ask whether recovery windows felt visible before consequences landed.
- Ask whether save/import/export language sounded like a promise.

WM-0109 readiness matrix:

- Treat this package as readiness evidence for controlled testing, not final
  Early Access release approval.
- Preserve the M5 hash and benchmark gates unless a future reviewed migration
  explicitly changes them.

## Change Policy

Future balance or readability tuning may edit content data only after a focused
task records:

- hypothesis;
- changed definitions or values;
- before/after deterministic evidence;
- `pnpm test --filter m5-invariants`;
- 100000-tick M5 scenario output;
- save/replay impact;
- benchmark impact if runtime cost can change;
- reviewer acceptance of any hash movement.
