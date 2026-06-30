# Post-M8 Playable Product Acceptance

Status: WM-0146 acceptance reset. This document is the product bar for the
post-M8 remediation DAG. It does not implement the slice, does not change any
release verdict, and does not authorize public release, Early Access, store
submission, signing, telemetry, accounts, paid services or public save
compatibility.

## Why This Exists

The Owner feedback is a hard product blocker:

- The current interface is overwhelming and does not tell the player what to
  do first.
- The screen reads like a diagnostics harness or status board instead of a
  game.
- The player cannot understand how to build, how to assign work, or how
  residents respond.
- NPCs that do not visibly move or act in a player-perceptible way are wrong
  for this genre.
- The experience does not yet meet the expected colony-sim baseline of a map,
  active pawns, visible work and readable command consequences.

The art-thread feedback sets the minimum correction: a low-fidelity but real
2-3 minute dusk lamp/simple-build slice. Final artwork is not required for this
bar. Static panels, hidden diagnostics and command feedback without visible
pawn behavior are not sufficient.

## Product Bar

A build may not be described as a playable product surface unless the default
player path satisfies all of these gates:

1. The map is the subject of the first screen, with active pawns visible before
   secondary records, long ledgers or developer evidence.
2. The player sees one current objective and one obvious first action.
3. At least one player command creates authoritative or reviewed command
   intent, produces a visible job marker, is claimed by a pawn, and changes
   pawn behavior on the map.
4. The pawn's state is legible through the full chain: idle, moving, working,
   blocked, completed and failed.
5. Failure is structured and actionable. "No work", "path failed" or "condition
   unmet" are not enough without a visible reason class and target.
6. The default HUD contains no product-gate, fixture, hash, protocol packet,
   release verdict or diagnostics language.
7. Chinese and English copy remain player-facing and localized; diagnostic
   labels may appear only behind explicit diagnostics/debug entry points.

## First-Five-Minute Slice

### Scenario Name

Dusk Lamp Gap / Simple Build

### Timebox

The slice must be understandable in the first five minutes and demonstrable in
2-3 minutes by a reviewer.

### Start State

- Phase: dusk preparation, before curfew.
- Map: a small town edge with one lit corridor, one gap near an east approach,
  one reachable stockpile, one existing lamp or lamp-frame target, and one
  simple build/repair site.
- Pawns: 2-4 visible residents with names and current states.
- Resources: concise counts for lamp oil, basic build material and any single
  relevant town pressure.
- Objective: "Close the lamp gap before curfew" or equivalent localized copy.
- Initial risk: a visible warning tied to the map target, not a hidden
  diagnostics note.

### Required Player Commands

The minimum slice needs one primary command and one backup command:

- Primary: prioritize lamp work, refill lamp, repair lamp or complete a lamp
  post/build site.
- Backup: inspect reason, focus target, assign worker or toggle a work priority
  for the selected target.

Both commands must be honest about authority. If the command is not yet wired
to authoritative simulation, it may not be presented as a completed product
gate. The accepted product target is an authoritative Simulation Worker or
reviewed command/job protocol path.

### Success Path

The reviewer should be able to see this chain without opening diagnostics:

1. Player selects the lamp gap, lamp, build site or relevant alert.
2. HUD/inspector shows one recommended action and why it matters.
3. Player issues the command.
4. A job marker appears on the target.
5. A pawn claims the job; the pawn list and map both show the claim.
6. The pawn moves toward the target; the map shows path/intent feedback.
7. The pawn works at the target with visible progress.
8. The target changes state when the job completes.
9. The objective, alert and selected inspector update to the completed state.
10. A concise completion reason is available in the UI.

### Structured Failure Paths

At least three failure paths must be visible in the slice:

- No capable worker: show the missing role/ability/schedule reason and the
  inactive or busy pawns that explain it.
- No path or unsafe path: show blocked route, lamp coverage gap, forbidden
  area, closed door or night-risk reason.
- Missing material or reserved material: show required material, available
  count, reservation contention or stockpile target.

Optional later failure paths include town-rule conflict, obligation risk,
target invalidated, interruption denied, and stale command basis. These are not
required for the first slice, but if they appear they must use the same
structured reason style.

## Visible NPC Action Contract

Every playable action in the slice must expose these states in player-readable
form:

| State | Map Evidence | UI Evidence | Minimum Meaning |
| --- | --- | --- | --- |
| Idle | Pawn is stationary and not on a job path | Pawn row says idle plus reason | The pawn has no current job or is waiting safely. |
| Moving | Pawn changes position over time | Current job step says moving/pathing | The pawn is going to a target or material. |
| Working | Pawn remains at target with progress cue | Job step and progress are visible | The pawn is actively refilling, repairing or building. |
| Blocked | Pawn/job marker shows blocked state | Top reason and target are visible | The job cannot proceed for a concrete reason. |
| Completed | Target and objective update | Completion reason is visible | The command produced the intended world/result state. |
| Failed | Pawn/job leaves terminal failed state | Failure code is grouped into readable cause | The command stopped and the player knows what to fix. |

Animation fidelity may be low. Colored dots, path lines, icons and progress
bars are acceptable. The hard requirement is that the player can perceive
action, state transitions and consequences without reading developer logs.

## First-Screen Information Priority

The default first screen must answer four questions in order:

1. Where is the town and who is acting?
2. What is the one thing I should handle now?
3. What can I click or command to handle it?
4. Why did the result happen?

Recommended layout priority:

- Center: map, active pawns, target markers, paths and lamp/build state.
- Top: time/phase, pause/speed, concise resource strip and at most three
  alerts.
- Left: residents/pawns only when they are relevant, selected, idle for a
  reason, at risk, moving, working or blocked.
- Right: selected object inspector with state, current job, reason and actions.
- Bottom: command bar with global modes and context actions.

Not allowed as default first-screen content:

- Product gate, fixture, hash, source package, release verdict, protocol or
  diagnostics copy.
- Long scroll panels that hide the map or the primary action.
- Dense status boards that list many warnings without ranking the next action.
- Disabled commands without reason text.
- UI copy that implies final release, Early Access launch, store submission or
  public save compatibility.

## Command And Authority Boundary

The slice must preserve the repository's authority rules:

- Simulation Worker / headless runtime remains authoritative.
- React, Pixi and Electron consume read models or send explicit commands; they
  do not mutate world state directly.
- Jobs are explicit serializable state machines, not coroutines, promises or
  UI closures.
- Work selection must use indexed offers, Top-K caps and structured reasons;
  no pawn thinking may scan the whole map.
- UI failure explanations are projections of authoritative or reviewed
  structured reasons, not invented corrections.

Shell-local adapter feedback like WM-0138 can remain as a temporary diagnostic
or development aid, but it does not satisfy this product acceptance reset on
its own.

## Downstream Acceptance Mapping

This document should guide the existing remediation DAG:

- WM-0147: simplify HUD around the first-screen priority rules above.
- WM-0148: make pawns, map targets and state markers semantically readable.
- WM-0149: design the authoritative lamp/build command and job protocol slice.
- WM-0150: implement the headless authoritative job execution.
- WM-0151: render pawn motion, intent paths, job markers and progress.
- WM-0152: connect player commands to the authoritative slice.
- WM-0153: repair first-play guidance, i18n and responsive layout around this
  product bar.
- WM-0154: produce visual/E2E evidence for the success and failure paths.
- WM-0155 and WM-0156: update readiness only after review; public gates remain
  owner-controlled.

No downstream task is promoted or executed by WM-0146.

## Reviewer Evidence Checklist

A reviewer should reject a future "playable UI" claim if any of these are
missing:

- First screen defaults to map and active pawns.
- One objective and one command path are obvious without opening diagnostics.
- A pawn visibly claims, moves, works and reaches a terminal state.
- Blocked/failed states expose structured reasons and targets.
- The UI explains how to build or drive work through commands, not prose alone.
- zh-CN and en both avoid raw fixture/developer strings in the player path.
- Web remains demo-only and Windows remains controlled-test until Owner changes
  the platform gates.
