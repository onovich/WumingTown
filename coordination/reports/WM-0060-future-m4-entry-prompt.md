# WM-0060 Future M4 Entry Prompt

Status: non-executable handoff artifact.

This document is not an instruction to start M4 during WM-0060. It must not be
used to create, promote, claim, implement, test, merge, or review M4 work as
part of WM-0060. A later reviewed M4 planning task must explicitly adopt or
replace this prompt before any M4 task DAG or implementation begins.

## Future Role

Use this only in a future planning session owned by `systems-architect` or
`project-director`, after the user explicitly authorizes M4 planning.

## Starting Context

M3 is closed by WM-0060 with reviewed evidence:

- Ordinary-life scenario id: `m3.ordinary_life.injured_caregiver.v1`
- Requested seed: `3`
- Authoritative scenario seed: `46`
- Command stream hash: `0x226832d2`
- Content hash: `0xdfe7107e`
- Long-run final world hash: `0x7eb81a69`
- Final M3 benchmark read-model hash: `0x82bf87d6`
- Save tick/load tick: `12000` / `12001`
- Worker parity checkpoints: `0`, `3600`, `7200`, `12000`, `18000`, `36000`
- Reviewed benchmark artifact:
  `coordination/artifacts/WM-0059/benchmarks/benchmark-results.json`
- Benchmark artifact SHA-256:
  `63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`

M3 capabilities now available for future composition: owner-store needs,
day/night/weather basics, rest/sleep jobs, food/eating logistics, health
conditions, ability cache invalidation, medical care jobs, mood/thought lanes,
relationship events, focused save/replay, Worker/headless parity, and M3
long-run benchmark invariants.

## Future M4 Planning Objective

Create a reviewed M4 planning package for the core Wuming Town vertical slice.
The package should decide how to introduce lamp network rules, Chronicle
evidence, obligations, anomaly/crisis chains, and director-facing recovery
windows without violating M0-M3 ownership, determinism, save/replay, Worker
authority, or benchmark gates.

The future M4 planning output should include:

- a refreshed M4 scenario contract with a concrete playable rule-discovery
  path;
- an architecture ADR or ADR amendment for M4 ownership, evidence facts,
  crisis state, director boundaries, save/replay scope and Worker projections;
- a task DAG with explicit dependencies, owners, reviewers, allowed paths,
  forbidden paths, required checks, benchmark impact and rollback model;
- explicit M4 non-goals and product risks;
- a performance and invariant plan preserving 10 percent warning and
  20 percent blocking benchmark thresholds;
- a migration policy for any new save or read-model fields, with public
  compatibility blocked unless separately approved.

## Hard Constraints For Future M4

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- M4 must not replace M3 owner stores with a monolithic director brain.
- Actor decisions must continue to use bounded indexes and Top-K candidate
  selection.
- Job and crisis progress must be explicit serializable state, not coroutine,
  Promise chain, closure, UI-local or thread-local state.
- New public Worker protocol, save format, schema, package dependency or
  package-boundary change requires its own reviewed gate.
- No M4 implementation begins until a future reviewed planning task creates
  concrete task packets.

## Questions For The Future Planning Task

- Which single player-understandable rule should the first M4 scenario prove?
- Which facts are ordinary M3 life facts, and which are M4 Chronicle evidence
  facts with different ownership and persistence?
- What is the minimal lamp network state that can matter mechanically without
  becoming a visual-only UI system?
- Which obligation or town-rule surfaces are needed for the first vertical
  slice, and which should remain content-only until M5?
- How will anomaly/crisis state be saved, replayed, explained and benchmarked?
- What closeout evidence would prove M4 without drifting into M5 content
  production?

## Explicit Stop Sign

Do not execute this prompt in WM-0060. Do not create `WM-0061` or any M4 task
from this prompt during M3 closeout. The only permitted WM-0060 action is to
store this artifact as future context.
