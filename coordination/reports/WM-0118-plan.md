# WM-0118 Plan

## Scope

Validate the productized M8 shell UI at the required responsive viewport sizes
and produce reviewer-checkable evidence for both Web and desktop shells on top
of current `main` commit `a0b3842`.

Required viewport set:

- `1280x720`
- `1366x768`
- `1424x861`
- `1600x900`
- `1920x1080`
- `2560x1369`
- `2560x1440`

Required UI evidence:

- default main menu / first-play guidance
- post-start player HUD
- separation between player UI and debug overlay
- right-side, bottom/top, map-adjacent and scrollable regions staying reachable
- zh-CN and en locale coverage, with any verified limitation recorded together
  with mitigation

Allowed implementation paths for this task:

- `apps/web/**`
- `apps/desktop-electron/**`
- `packages/ui-react/**`
- `tools/**`
- `package.json`
- `coordination/reports/WM-0118*.md`
- `coordination/tasks/WM-0118.json`

Out of scope:

- `packages/sim-core/**`
- `packages/sim-worker/**`
- benchmark-baseline weakening
- release/store/signing/telemetry/account/paid-service work

## Current Facts

- `WM-0117` already proved bounded player HUD vs gated debug overlay at
  `1424x861` and `390x720`, but not the full M8 viewport matrix.
- `WM-0119` added first-play guidance and locale assertions, but reviewer
  artifacts for the final viewport set are still missing.
- Existing Web and desktop E2E already boot the real shell and are the right
  place to add deterministic viewport/layout evidence without weakening gates.

## Execution Plan

1. Extend Web E2E with deterministic responsive evidence.
   - Cover all seven required viewports.
   - Assert menu guidance and post-start HUD in both locale states.
   - Capture structured DOM-layout artifacts and a small screenshot set under
     `coordination/artifacts/WM-0118/`.

2. Extend desktop E2E with matching responsive evidence.
   - Reuse the same viewport matrix inside Electron.
   - Prove default player UI and explicit debug overlay remain separated.

3. Keep artifacts reviewer-friendly and low-volume.
   - Prefer JSON layout evidence for every viewport/locale combination.
   - Keep screenshots to a small curated subset that demonstrates the main menu,
     in-game HUD and debug overlay paths without adding unnecessary binary bulk.

4. Only patch product code if validation reveals a real responsive defect.
   - Do not weaken tests or reduce viewport coverage to make the task pass.
   - If a verified limitation remains, document the exact failed surface and the
     mitigation in `coordination/reports/WM-0118.md`.

5. Run the required checks unchanged and finish the workflow handoff.

## Artifact Plan

Primary artifact root:

- `coordination/artifacts/WM-0118/`

Planned artifact types:

- `web-responsive-layout.json`
- `desktop-responsive-layout.json`
- a small screenshot subset for reviewer inspection, likely:
  - menu `zh-CN`
  - menu `en`
  - in-game HUD
  - debug overlay

If task policy or tooling makes a different exact filename more practical, the
final report will list the produced paths explicitly.

## Checks

- `corepack pnpm test:e2e --filter web-shell`
- `corepack pnpm test:e2e --filter desktop-shell`
- `corepack pnpm quality`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`

## Risks

- Very large desktop viewports can expose absolute-position or max-width issues
  that smaller layout tests do not catch.
- zh-CN strings are longer in some cards and may change scroll behavior
  differently from en.
- Binary screenshot artifacts can grow quickly, so artifact output must stay
  selective and deterministic.
