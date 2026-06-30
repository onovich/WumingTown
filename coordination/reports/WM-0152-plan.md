# WM-0152 Execution Plan

## Scope

Deliver the first real player-facing lamp/build command chain only if `apps/web`
can both:

- legally issue WM-0150 playable commands to the authoritative Simulation
  Worker through public package surfaces, and
- receive enough authoritative playable projection data back to render HUD,
  placement, job markers, pawn movement/progress, and structured blocked
  reasons without shell-local simulation.

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

Initial blocker is resolved:

- `apps/web` now has the reviewed root dependency on `@wuming-town/sim-worker`.
- `apps/web/src/simulation-worker-session.ts` can create a public
  browser-session bridge and start the WM-0150 scenario without deep imports.

New blocker after resumed investigation:

- `apps/web/src/shell-bootstrap.ts` still wires the reviewed local
  `createReviewedPlayableProjectionSession()` harness and updates HUD/debug
  state from that playback rather than from live Worker projection data.
- `packages/sim-protocol/src/types.ts` still defines `RenderSnapshotPayload`
  and `UiDeltaPayload` as hash/summary carriers only; there is no public
  authoritative playable read-model payload for Web to render.
- WM-0157 explicitly records this gap: "Current Worker `UiDelta` still carries
  compact summaries, not a full public playable read-model object for Web
  product UX."
- The authoritative playable runtime does have a focused read-model shape
  internally (`PlayableReadModel` in `sim-core`), but `apps/web` cannot reach
  it through the current public Worker protocol, and WM-0152 is not allowed to
  edit `packages/sim-worker/**`.
- The current Web save flow in `apps/web/src/web-storage-gate.ts` is still the
  M6 gate envelope and explicitly strips `playableAction` on load. That can be
  truthfully presented as unsupported, but it does not solve the missing live
  projection surface.

## Planned action

Stop and raise a new blocker. WM-0152 can now send authoritative commands, but
it still cannot render the authoritative command chain honestly because the
public Worker protocol does not deliver a public playable projection object.

Required owner decision now:

- expose the authoritative WM-0150 playable read-model through the public
  Worker protocol/session surface, including the basis/action/job/pawn/build
  fields needed by ADR-0012 UI wiring; or
- provide an equivalent reviewed public adapter that delivers that projection to
  `apps/web` without deep imports or shell-local simulation.

No product code should claim live authoritative motion/progress until that
projection surface exists.
