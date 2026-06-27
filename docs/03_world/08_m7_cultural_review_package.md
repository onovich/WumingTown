# M7 Cultural Review Package

Status: reviewed M7 preparation artifact after WM-0101 review. This document is
not final legal, cultural-consultant, store, privacy or release approval.

## Scope

M7 prepares Early Access and public playtest material. Public-facing copy,
tester instructions, screenshots, trailers, store drafts and release notes must
use this package as a gate before they are treated as ready.

This review covers:

- folk-horror and zhiguai-inspired expression;
- fictionalization and source-note boundaries;
- sensitive-topic handling;
- Chinese and English terminology;
- public-facing claim limits for WM-0106 and WM-0108.

This review does not approve public release, store submission, signed builds,
telemetry, account systems, paid services, final legal/privacy/store claims,
public save-compatibility promises or M8 work.

## Roadmap Boundary

Current Roadmap authority remains:

- M6 = Web / Windows Product Gate.
- M7 = Early Access / public playtest preparation.
- M8 = 1.0.

Web remains `demo-only`. Windows remains unsigned
`ready-for-controlled-external-test`. Any copy that implies full Web support,
public release readiness or signed Windows release is blocked.

## Fictionalization Rules

Wuming Town is a fictional setting. Its civic records, lamp network, town
ordinances, debts, visitors and anomalous rules are invented systems composed
from the project's own world logic. They must not be presented as direct
records of real folklore, real history, a real ethnic group, a real religious
practice or a real legal/medical claim.

Allowed:

- "fictional folk-horror town simulation";
- "zhiguai-inspired" when paired with "fictional" or "inspired";
- "draws on civic records, local rumor and social obligation as fictional game
  systems";
- "not a historical reconstruction".

Blocked:

- "authentic folklore simulation";
- "based on real secret rituals";
- "historically accurate ancient China";
- "real religious practice";
- "medical, legal or spiritual advice";
- "the true origin of..."

## Sensitive-Topic Rules

Public-facing M7 material must avoid:

- making a real religion, minority practice or sacred ritual into enemy magic;
- using disability, mental illness, bodies, burial customs or mourning practice
  as shock value;
- reducing women, elders, children, outsiders or rural residents to a single
  victim/witch/backward/monster role;
- claiming that "ancient Chinese people all believed..." or any equivalent
  flattening statement;
- copying a specific folk tale's distinctive text, plot or ritual detail
  without recorded source and rights review.

When a draft needs a real-world reference, it must use a `source_note` entry
before downstream review:

```text
source_note:
  source_type: academic | local_record | museum | modern_retelling | web_rumor | internal_fiction
  region_or_context:
  date_or_period:
  reliability:
  adaptation_summary:
  risk:
  review_status: draft | needs_owner_review | needs_external_review | approved_for_internal_draft
```

`web_rumor` is not enough for public copy. It can seed internal questions only.

## Public Copy Claim Limits

Every M7 public-facing draft must be able to answer:

- What is fictional?
- What is a player-facing game system?
- What remains unknown or unresolved?
- Which platform verdict applies?
- Which owner approval is still required?

The safe default formula is:

```text
Wuming Town is a fictional town-simulation and folk-horror game about civic
memory, lamplight, obligation and uncertain evidence. M7 material is an
internal/external-test draft, not final release copy.
```

Do not use copy that claims:

- final Early Access launch approval;
- store-page publication approval;
- final privacy/legal approval;
- final save compatibility;
- public Web release;
- signed Windows installer availability.

## Terminology Rules

Canonical terms for M7 drafts:

| Concept | Chinese draft | English draft | Rule |
| --- | --- | --- | --- |
| Project title | 无明镇 | Wuming Town | Keep as title; do not translate as a real place. |
| Town record | 镇志 | Chronicle | "Chronicle" is a game system, not a historical archive claim. |
| Lamp network | 灯网 | lamp network | Use plain lowercase in body copy. |
| Town rule | 镇规 | town ordinance | Avoid "law" unless discussing in-world governance. |
| Old debt | 旧债 | old debt / obligation | Prefer "obligation" for system copy. |
| Anomalous beings | 异类 | anomalous visitors / anomalies | Avoid "monster race" as default. |
| Borrowed Shadow | 借影客 | Borrowed Shadow | Fictional anomaly name; do not tie to real shadow folklore. |
| Third Knock | 第三声 | Third Knock | Fictional signal/rule; do not call it a real omen. |
| Old Bridge Guest | 旧桥客 | Old Bridge Guest | Fictional visitor; do not cite a real bridge legend. |
| Dawn review | 黎明复盘 | dawn review | A system review step, not ritual divination. |

Terms to avoid unless a reviewed draft explains the reason:

- exorcism, curse-breaking, evil cult, demon race, primitive belief;
- authentic, real, historically accurate, sacred, taboo ritual;
- madness, insane, crippled, deformed as horror punchlines;
- cure, diagnosis, legal guarantee, consent guarantee.

## M7 Downstream Gates

WM-0106 store/playtest material must:

- label all material as draft/non-final;
- cite this document for fictionalization and terminology;
- cite WM-0103 for Windows controlled-test scope;
- cite WM-0104 for Web demo-only scope;
- keep screenshot/trailer shot lists away from identifiable real rituals or
  sacred practice.

WM-0108 playtest protocol must ask testers to flag:

- terms that sound like real-world claims;
- confusing difference between fiction and source inspiration;
- insensitive framing of residents, outsiders, disability, illness, mourning or
  religion;
- platform/release overclaims.

WM-0109 readiness must record unresolved cultural risks separately from
technical readiness.

## Current Review Verdict

M7 can proceed with internal and controlled external draft material if the
rules above are followed. Owner approval or external review is still required
before using any identifiable real ritual, sacred practice, minority-group
symbol, sensitive historical event or "authentic folklore" marketing claim.

No current M7 task is allowed to convert this package into public release
approval.
