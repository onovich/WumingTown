# WM-0082 - M5 Worker Projections And Parity

## Goal

Expose M5 alpha content framework state as read-only Worker projections and
prove Node Worker/browser Worker parity at fixed checkpoints without changing
public Worker protocol families.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0082.json`
- `coordination/decisions/ADR-0010.md`
- `docs/02_systems/19_m5_alpha_content_framework_scenario.md`
- `docs/05_tech/02_worker_protocol.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- Existing M3/M4 Worker parity tests and browser Worker smoke.

## Non-Goals

- No public Worker protocol redesign, new message family or client-side
  authority.
- No public save format, benchmark baseline, dependency, Electron or M6 work.

## Approach

- Reuse existing `InitSession`/`PlayerCommandBatch` and Worker output message
  families with optional read-only M5 projection metadata.
- Add M5 projection builder in sim-core that wraps the WM-0080/WM-0081
  deterministic scenario/save basis: content manifest, anomaly roster,
  faction/governance, season event, validation, review basis and canonical
  projection hash.
- Extend sim-worker's focused parity mode to handle
  `m5-alpha-content-framework` without giving UI mutation authority.
- Add Node Worker parity tests for checkpoint hashes, projection byte sizes,
  stale-basis rejection and no UI repair path.
- Extend browser Worker smoke to run M5 through the existing Worker harness.

## Risks

- Projection fields could become a public protocol commitment; report must
  state they are optional focused payload metadata.
- Stale projection basis could be accepted by client code; tests must assert a
  structured discard/reject reason.
- Worker parity could compare only world hashes and miss projection drift; tests
  must compare projection hash and byte sizes.

## Checks

- `pnpm typecheck`
- `pnpm test --filter m5-worker-parity`
- `pnpm test:e2e --filter worker-smoke`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert M5 projection/parity code, tests, docs, artifacts and report. Leave
WM-0080 scenario and WM-0081 save/replay harness intact.
