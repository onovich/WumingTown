# WM-0153 Plan - First-play guidance localization and responsive repair

## Scope

Implement WM-0153 as a client/UI repair on top of the verified WM-0152 playable Worker command chain. The UI must guide players through the real lamp/build flow, keep Settings and diagnostics secondary, preserve Worker authority, and avoid claiming unavailable commands.

Allowed implementation paths only:

- `apps/web/src/**`
- `packages/ui-react/src/**`
- `packages/renderer-pixi/src/**`
- `coordination/reports/WM-0153*.md`
- `coordination/tasks/WM-0153.json`

No Simulation Worker, `sim-core`, package-boundary, public save compatibility, release, telemetry, account, paid-service, or store/signing changes.

## Findings Before Product Edits

- WM-0152 is live in the Web shell through the public Web Worker adapter: HUD commands dispatch via `sendWebPlayableCommandBatch`, command results update `playableAction`, and accepted commands drain with `drainWebPlayableCommandsToTerminal`.
- The first-play surface already references lamp/build commands, but the copy is too compressed and still lets secondary save/settings caveats dominate part of the first screen.
- Some zh-CN command copy still says local action for lamp commands even though the current path is authoritative Worker command dispatch.
- Worker projection-derived labels are English fixture strings. The UI localization layer needs to cover the new WM-0152 structure, job, alert, resource, and progress strings so zh-CN player surfaces do not mix languages.
- Existing E2E has broad responsive coverage from earlier tasks, but WM-0153 needs targeted evidence for 1280x720, 1366x768, 1600x900, and 1920x1080 with map focus, active pawn/action feedback, action bar, and inspector usability.

## Implementation Plan

1. First-play guidance and player HUD copy
   - Rewrite start-surface guidance around the concrete flow: enter town, select East Market Lantern Post, issue lamp priority, enter Build mode, hover valid/invalid blueprint tiles, place blueprint, then read accepted/rejected command feedback, job marker, pawn movement/work/progress, completion, or blocked reason.
   - Keep unavailable command slots explicitly disabled/placeholders, not advertised as supported actions.
   - Keep Settings as a secondary display surface and diagnostics behind `wmDiagnostics=1`.

2. Localization consistency
   - Replace stale zh-CN local-action lamp copy with authoritative Worker command copy.
   - Add fixture-localization mappings for WM-0152 projection strings emitted into read models, including structure summaries, job marker labels/details, alert labels/details, resources, and pawn/activity statuses.
   - Keep brand names acceptable, but prevent mixed command/job/status/player UI text in zh-CN.

3. Responsive and accessibility repair
   - Check HUD layout at 1280x720, 1366x768, 1600x900, and 1920x1080. Adjust HUD grid/command bar/side rails only if tests show map focus, action bar, active feedback, or inspector are obscured or unreachable.
   - Ensure button labels remain explicit, disabled states use `aria-disabled` plus visible copy, state is not color-only, long text wraps, and hover/focus affordances remain inspectable.

4. Tests and evidence
   - Update `packages/ui-react/src/shell-hud.test.ts` for first-play copy and zh-CN authoritative command wording.
   - Update `apps/web/src/web-shell.e2e.test.ts` with WM-0153-focused locale/responsive/accessibility assertions around the real WM-0152 flow.
   - Preserve generated artifacts outside allowed paths if required tests rewrite them.

## Required Checks

- `corepack pnpm typecheck`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

If implementation reveals a missing public UI/Worker surface, stop and block with the exact missing contract instead of faking command state.
