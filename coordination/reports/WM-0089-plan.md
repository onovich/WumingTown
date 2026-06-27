# WM-0089 - SharedArrayBuffer unavailable fallback gate

## Goal

Prove the Web Worker path still runs when SharedArrayBuffer is unavailable,
while keeping the Simulation Worker/headless runtime authoritative and keeping
UI consumers on read-only projections.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0089.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `coordination/reports/WM-0086.md`
- `coordination/reports/WM-0087.md`
- `docs/05_tech/02_worker_protocol.md`
- `docs/05_tech/03_performance_budget.md`
- `docs/05_tech/06_platform_matrix.md`
- `docs/06_engineering/00_coding_standard.md`
- `packages/sim-worker/**`
- `packages/sim-protocol/**`
- `packages/platform/**`
- `apps/web/**`

## Non-Goals

- No public protocol family, schema version or envelope redesign.
- No UI authority or UI-side repair path.
- No real-time, ambient-random or host-clock simulation authority.
- No server, account, deployment or M7 hosting assumption.
- No M6 decision to claim same-spec Web performance.

## Current Facts And Assumptions

- Current browser Worker smoke tests already run through module Workers with
  structured-clone messages and read-only `RenderSnapshot` / `UiDelta`
  payloads.
- The Web product gate records cross-origin isolation and says SAB is optional,
  but WM-0089 still needs explicit SAB-unavailable gate evidence.
- Vite's local e2e server is not expected to provide COOP/COEP, so Chromium
  should be a realistic non-isolated Web fallback path.
- The current M5 browser Worker path is checkpoint/projection evidence, not a
  full 20k-entity continuous browser authority runtime.

## Approach

- Add a small `sim-worker` runtime transport gate helper that selects
  `transferable-snapshot` fallback when cross-origin isolation or
  SharedArrayBuffer is unavailable.
- Keep the helper internal to public package exports and avoid changing
  protocol versions, payload schemas or Worker message kinds.
- Extend `worker-smoke` coverage to assert that the browser module Worker runs
  M5 read-only projections in a non-isolated / SAB-unavailable runtime and
  that hashes still match headless evidence.
- Record the cross-origin-isolation assumptions and current fallback cap /
  performance implication in docs and report.

## Risks

- Browser APIs expose SAB differently depending on COOP/COEP and engine
  policy, so tests must record runtime facts instead of assuming only one
  global shape.
- A transport helper could be mistaken for a new public protocol; keep it as a
  local selection record and avoid envelope changes.
- Fallback evidence could be over-claimed as a same-spec Web pass; report it
  only as protocol/authority evidence.

## Implementation Steps

1. Add the transport gate helper and focused unit assertions.
2. Extend real browser `worker-smoke` to return runtime isolation/SAB facts
   alongside Worker messages.
3. Add a SAB-unavailable M5 parity test that confirms read-only projections,
   headless hashes and fallback transport selection.
4. Update worker protocol and platform matrix docs with WM-0089 evidence and
   cap implications.
5. Run required checks and write the final WM-0089 report.

## Tests And Evidence

- `pnpm typecheck`
- `pnpm test --filter worker-smoke`
- `pnpm test:e2e --filter worker-smoke`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert the WM-0089 transport helper, worker-smoke additions, docs and report.
The Web product gate would then keep SharedArrayBuffer fallback as an
unevidenced blocker.

## Done Conditions

- A real browser Worker run records a non-isolated / SAB-unavailable fallback
  path.
- Worker authority remains in the Worker/headless runtime and projections are
  read-only.
- No public protocol/schema redesign is introduced.
- Cross-origin isolation assumptions and fallback cap/performance implications
  are documented.
