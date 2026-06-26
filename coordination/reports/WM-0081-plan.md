# WM-0081 - M5 Focused Save Replay

## Goal

Add a focused save/load/resume harness for
`m5.alpha_content_framework.first_season.v1` that proves a saved M5 checkpoint
can load in scratch state, rebuild derived surfaces, and match uninterrupted
replay through the 36000 tick horizon.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0081.json`
- `coordination/decisions/ADR-0010.md`
- `docs/02_systems/19_m5_alpha_content_framework_scenario.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- Existing M3/M4 focused save replay harnesses and diagnostics.

## Non-Goals

- No public save compatibility, platform save UI, schema migration, codec
  dependency or cross-version promise.
- No Worker protocol or browser Worker parity implementation.
- No benchmark baseline updates and no M6 task creation or implementation.

## Approach

- Add `packages/sim-core/src/m5-save-replay.ts` mirroring the M4 focused
  harness shape, using WM-0080 scenario output as the deterministic source.
- Save envelope records scenario id, alias, requested/authoritative seed,
  content manifest hash, command stream hash, save tick, next tick, owner-store
  diagnostics, deterministic stream positions, command tail, checkpoint hashes
  and read-only projection hashes.
- Load validates unknown input in scratch before mutation: magic, versions,
  scenario id, seed, content identity, owner handles, integer lanes, anomaly,
  faction, governance, event, random stream and command continuity.
- Load rebuilds named derived surfaces for anomaly roster, anomaly stores,
  faction/governance, season events, content validation, WorkOffer, path,
  read-model, review and metrics before the first resumed tick.
- Replay diagnostics add `--scenario m5-alpha-content-framework` under
  `coordination/artifacts/WM-0081/m5-save-replay/`.

## Risks

- The harness could look like a public save format; docs and report must name
  it as focused scenario-only evidence.
- Content manifest validation could drift from WM-0079/WM-0080 canonical
  basis; tests must reject mismatched content hash before load.
- Derived surfaces could be treated as persisted authority; load output must
  report rebuilt hashes only.

## Implementation Steps

1. Add M5 focused envelope, load, resume, comparison and command-id helpers.
2. Add focused tests for parity, scratch validation failures, rebuilt surfaces,
   divergence diagnostics and deterministic command ids.
3. Register `m5-save-replay` test filter and M5 replay diagnostics CLI path.
4. Update docs/report/artifacts with save bytes, validation/rebuild metrics,
   checkpoint hashes, first divergent tick and stop signs.

## Checks

- `pnpm typecheck`
- `pnpm test --filter m5-save-replay`
- `pnpm sim:replay-test -- --scenario m5-alpha-content-framework`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert `m5-save-replay` code, tests, replay diagnostics registration, WM-0081
artifacts, docs and report. Leave WM-0080 integrated scenario intact.
