# WM-0109 Execution Plan

## Task

WM-0109 - M7 validation matrix and readiness decision.

## Scope

- Consolidate verified M7 evidence into a readiness decision matrix.
- Record Early Access readiness, public playtest readiness, Web demo readiness
  and Windows controlled external test readiness separately.
- Run required M0-M6/M7 regression gates.
- Preserve all owner-gated release, store, signing, telemetry, account, paid,
  public feedback, final privacy/legal/store and public save compatibility
  decisions.

## Upstream Audit

All upstream M7 tasks were audited from task JSON:

- WM-0099: `done`, review `verified`, integrated.
- WM-0100: `done`, review `verified`, integrated.
- WM-0101: `done`, review `verified`, integrated.
- WM-0102: `done`, review `verified`, integrated.
- WM-0103: `done`, review `verified`, integrated.
- WM-0104: `done`, review `verified`, integrated.
- WM-0105: `done`, review `verified`, integrated.
- WM-0106: `done`, review `verified`, integrated.
- WM-0107: `done`, review `verified`, integrated.
- WM-0108: `done`, review `verified`, integrated.

## Implementation Steps

1. Create a readiness matrix under `docs/07_roadmap/`.
2. Update `coordination/project-state.json` to mark WM-0109 readiness
   evaluation active without closing M7 or starting M8.
3. Run required checks:
   - `node tools/validate-handoff.mjs`
   - `taskctl validate/status`
   - `git diff --check`
   - `pnpm quality`
   - `pnpm ci:local`
   - `pnpm test --filter m5-invariants`
   - `pnpm bench`
   - `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
4. Write WM-0109 report and complete to independent reviewer.

## Non-Goals

- No public release, Early Access launch, store submission, public Web launch,
  signing, installer or updater.
- No telemetry, accounts, paid services, crash upload or public feedback
  service.
- No final privacy/legal/store or public save compatibility claim.
- No M8 task creation, promotion, claim, implementation or review.
