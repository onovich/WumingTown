# WM-0152 Execution Plan

## Scope

Deliver the first real player-facing lamp/build command chain only if `apps/web`
can legally issue WM-0150 playable commands to the authoritative Simulation
Worker through existing public package surfaces.

## Workflow status

- Read `AGENTS.md` and `.agents/skills/wuming-town-agent-workflow/SKILL.md`.
- Ran `taskctl validate` and `taskctl status`.
- Read task packet, WM-0147/WM-0150/WM-0151 reports, `apps/web/src/*`,
  `packages/ui-react/src/*`, `packages/sim-protocol/src/*`,
  `docs/01_design/05_ui_ux_information_design.md`,
  `docs/02_systems/03_map_space_rooms_lanterns.md`.
- Claimed `WM-0152` as `client-engineer` on thread `Command Loom`.

## Decision gate

1. Verify whether `apps/web` already has a legal public path to:
   - create or connect to a browser Simulation Worker runtime,
   - send `PlayerCommandBatch` messages with WM-0150 payloads,
   - receive authoritative `CommandResult` / `RenderSnapshot` / `UiDelta`
     messages,
   - keep save/load behavior truthful for in-progress command state.
2. Only if that path exists, implement a thin client adapter plus HUD/placement
   UI, localization, read-only projection rendering, and focused tests.
3. If the path does not exist, stop before product-code edits and block the
   task with the exact missing public protocol/package-boundary decision.

## Findings

- `apps/web/package.json` currently allows
  `@wuming-town/foundation`, `@wuming-town/platform`,
  `@wuming-town/renderer-pixi`, `@wuming-town/sim-protocol`,
  and `@wuming-town/ui-react` only. It does not allow
  `@wuming-town/sim-worker`.
- `apps/web/src/shell-bootstrap.ts` still wires the reviewed local
  `createReviewedPlayableProjectionSession()` harness and updates HUD/debug
  state from that projection playback rather than from live Worker messages.
- `packages/sim-protocol` exposes the WM-0150 command/result types, but it does
  not expose a browser-side session client or Worker bootstrap.
- `packages/sim-worker/src/browser-worker-entry.ts` exists, but it is a package
  internal file and is not exported through a reviewed public entrypoint.
- The current Web save flow in `apps/web/src/web-storage-gate.ts` is still the
  M6 gate envelope and explicitly strips `playableAction` on load. It is not an
  authoritative playable-command persistence surface.

## Planned action

Stop and raise a blocker. Implementing WM-0152 inside the current allowed paths
would require at least one unapproved boundary change:

- a new public browser Worker entry/client surface,
- a reviewed `apps/web -> @wuming-town/sim-worker` dependency decision, or
- a reviewed platform-owned adapter that exposes the authoritative session to
  Web without deep-importing package internals.

No product code will be changed until that decision exists.
