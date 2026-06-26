# WM-0071 Future M5 Entry Prompt

Status: non-executable handoff artifact.

This document is not an instruction to start M5 during WM-0071. It must not be
used to create, promote, claim, implement, test, merge or review M5 work as
part of WM-0071. A later reviewed M5 planning task must explicitly adopt,
replace or reject this prompt before any M5 task DAG or implementation begins.

## Future Role

Use this only in a future planning session owned by `systems-architect` or
`project-director`, after the user explicitly authorizes M5 planning.

## Starting Context

M4 is closed by WM-0071 with reviewed evidence for:

- Scenario id: `m4.core_vertical_slice.borrowed_shadow_lamps.v1`
- Alias: `m4-core-vertical-slice`
- Requested seed: `4`
- Authoritative scenario seed: `50`
- Content hash: `0x698f2c41`
- Command stream hash: `0x538d0e43`
- 36000-tick final world hash: `0xc201a925`
- 36000-tick scenario read-model hash: `0xce261d9d`
- 100000-tick final world hash: `0xdafa3b25`
- 100000-tick scenario read-model hash: `0xa896439d`
- Focused save tick/load tick: `12000` / `12001`
- Worker parity checkpoints: `0`, `3600`, `7200`, `12000`, `18000`, `36000`
- Reviewed benchmark artifact:
  `coordination/artifacts/WM-0070/benchmarks/benchmark-results.json`
- Benchmark artifact file SHA-256:
  `FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`

M4 capabilities now available for future composition include authoritative lamp
network facts, Chronicle evidence and dissemination, obligations, town-rule
compliance, the focused borrowed-shadow crisis state machine, director recovery
windows, structured dawn-review rows, focused save/replay, Worker/headless
parity and M4 long-run benchmark/invariant evidence.

## Future M5 Planning Objective

Create a reviewed M5 planning package for the alpha content framework. M5
should decide how to expand from one proven rule-discovery vertical slice into
repeatable content production without weakening the M0-M4 ownership,
determinism, save/replay, Worker authority, evidence, explanation or benchmark
gates.

The future M5 planning output should include:

- a refreshed alpha-content scenario contract;
- an architecture ADR or ADR amendment for anomaly roster, faction/campaign
  scope, governance, season/event pools, data-mod content and content
  validation boundaries;
- a task DAG with dependencies, owners, reviewers, allowed paths, forbidden
  paths, required checks, benchmark impact and rollback model;
- explicit data-mod and content-schema policy;
- a performance and invariant plan preserving the 10 percent warning and
  20 percent blocking benchmark thresholds;
- save/replay and Worker projection expectations for any new public or
  content-driven surfaces;
- product risks and stop signs for content production that requires bespoke
  code per item.

## Hard Constraints For Future M5

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- M5 must not replace M4 owner stores with a monolithic director or narrative
  brain.
- Actor, anomaly, obligation, town-rule and director choices must continue to
  use bounded indexes and stable Top-K selection.
- Job and crisis progress must remain explicit serializable state, not
  coroutine, Promise chain, closure, UI-local or thread-local state.
- New public Worker protocol, save format, schema, package dependency or
  package-boundary change requires its own reviewed gate.
- Data mods must be schema-validated; arbitrary code mods remain out of scope
  unless a later security gate approves them.
- No M5 implementation begins until a future reviewed M5 planning task creates
  concrete task packets.

## Questions For The Future Planning Task

- Which three anomaly rules are the smallest useful alpha roster, and how does
  each reuse M4 evidence, lamp, obligation, crisis and dawn-review surfaces?
- Which faction or governance mechanics can be expressed as owner-store facts
  rather than director-owned hidden state?
- What content schema changes are needed, and how will invalid content fail
  closed before reaching runtime?
- Which new benchmark counters are required before expanding content volume?
- What save/replay and Worker parity gates prove that data-driven content is
  deterministic and read-only to clients?
- Which M4 residuals should remain non-goals for M5 rather than being pulled
  into alpha content production?

## Explicit Stop Sign

Do not execute this prompt in WM-0071. Do not create `WM-0072` or any M5 task
from this prompt during M4 closeout. The only permitted WM-0071 action is to
store this artifact as future context.
