# WM-0152 Execution Plan

## Scope

Finish the player-facing lamp/build command chain on top of the public WM-0158
Worker projection path. The Web shell must send real WM-0150 commands through
the reviewed Worker bridge, render read-only authoritative outcomes, localize
the surfaces in en/zh-CN, and keep save/load claims honest.

## Workflow status

- Read `AGENTS.md` and `.agents/skills/wuming-town-agent-workflow/SKILL.md`.
- Ran `taskctl validate` and `taskctl status`.
- Confirmed `coordination/tasks/WM-0152.json` is still dirty from
  project-director unblock and must be preserved.
- Re-read the current `apps/web`, `packages/ui-react`, `packages/sim-protocol`,
  and WM-0158 public projection surface.

## Constraints

- Authority stays in the Simulation Worker only.
- `apps/web` may use only the reviewed public Worker/session APIs.
- Command payloads must come from `projection.targets[].actions[].payload` and
  `projection.placements[].command.payload`.
- UI must not parse Worker `summaries`, import `sim-core`, or recreate a local
  authority layer.
- Save/load must stay explicitly scoped to the existing M6 shell evidence
  envelope; no new public save compatibility promise.

## Implementation plan

1. Add a thin Web projection adapter that:
   - reads `PlayableProjectionV1` from `readWebPlayableProjection(message)`,
   - maps authoritative protocol refs/cells into Web-facing read-model overlays,
   - derives localized command surface inputs, build placement previews, job
     markers, pawn motion/progress, alerts, and resource summaries without
     mutating authority.
2. Replace `createReviewedPlayableProjectionSession()` wiring in
   `apps/web/src/shell-bootstrap.ts` with the public Worker session:
   - start the playable scenario,
   - subscribe to `UiDelta` and reliable `CommandResult` messages,
   - issue real command batches from HUD actions,
   - update the store from authoritative projection and command replies,
   - expose debug payloads from the authoritative projection path.
3. Update `packages/ui-react` shell contracts and HUD logic so the action bar:
   - shows only authoritative lamp/build availability,
   - supports build mode enter/hover/place flow,
   - surfaces accepted/rejected command feedback and blocked reasons honestly,
   - localizes all player-facing copy in en and zh-CN.
4. Keep save/load truth explicit:
   - drop in-progress/completed authoritative command UI state from the M6
     shell envelope on save/load,
   - state that the envelope restores shell selection only, not authoritative
     Worker command runtime.
5. Refresh focused tests and E2E evidence, then write the final WM-0152 report
   and complete to reviewer if the full required gate passes.

## Known design choices

- The Worker slice exposes protocol-owned refs/cells rather than Web entity ids,
  so the adapter will map those refs into the existing shell world presentation
  with reviewed static correspondence and read-only overlays.
- Build mode is UI-local state only. Placement validity and command payloads are
  still authoritative because they come from the Worker projection.
- The Web shell may present richer map/status feedback than the raw protocol,
  but only as a projection of authoritative state already returned by the
  Worker.
