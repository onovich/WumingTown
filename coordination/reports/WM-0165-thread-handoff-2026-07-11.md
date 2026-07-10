# WM-0165 Root Thread Handoff - 2026-07-11

## Handoff status

This document transfers the active Wuming Town project-director work to a new root thread at the owner's request.

- Work is intentionally paused.
- No command, MCP operation, worker, reviewer, or subagent is currently running.
- The active implementation worker finished its current command naturally before stopping.
- No cleanup, rollback, merge, integration, task completion, or push was performed during the pause.
- There is exactly one Git worktree: `D:/WebProjects/WumingTown`.

## Current objective

Continue the approved playable-product recovery roadmap. The current critical-path task is:

- `WM-0165` - PR-1 product read-model default GameSession route
- Owner role: `client-engineer`
- Reviewer role: `systems-architect`
- Current task state: `changes_requested`
- Current claim: retained by `client-engineer / Canvas WM-0165`
- Current branch: `task/WM-0165-pr-1-product-read-model-default-gamesession-route`

The implementation and all requested fixes are committed, but the final `taskctl complete` has deliberately not been run because the owner requested this handoff.

## Git state

- Branch HEAD: `6eb4ab381e6b266581a32eacbb14b598d192ffe8`
- HEAD subject: `fix(web): isolate WM-0165 diagnostics graph`
- `main`: `2ffa2e1 chore(coordination): close WM-0164`
- `origin/main`: `2ffa2e1 chore(coordination): close WM-0164`
- Main is already pushed through WM-0164.
- WM-0165 is not merged or pushed.

Commits on the WM-0165 branch above main, oldest to newest:

1. `0591967 feat(web): route default shell to GameSession projection`
2. `7f38bc1 docs(wm-0165): resolve resource presentation blocker`
3. `8f9dfee fix(web): close WM-0165 review findings`
4. `6eb4ab3 fix(web): isolate WM-0165 diagnostics graph`

Expected dirty control-plane files that must be preserved:

```text
M  coordination/tasks/WM-0165.json
?? coordination/inbox/client-engineer/MSG-MRF5L4N3-246003.json
?? coordination/inbox/client-engineer/MSG-MRF6IQ0Z-FD3518.json
?? coordination/inbox/client-engineer/MSG-MRF91OH8-F62018.json
?? coordination/inbox/systems-architect/MSG-MRF4S1ZR-C985B6.json
?? coordination/inbox/systems-architect/MSG-MRF60LGK-22984B.json
?? coordination/inbox/systems-architect/MSG-MRF8BDQG-1D6650.json
```

This handoff document itself is also untracked until the new root thread decides how to include it. Do not discard any of these files.

## Completed work and evidence

WM-0165 now routes the default Web shell to the schema-v3 GameSession projection and removes static fixture authority from normal gameplay.

The final fix at `6eb4ab3` closes the last reviewer High finding:

- `shell-bootstrap.ts` no longer statically loads the diagnostic package gate on the default route.
- Diagnostics/history modules load only after explicit `wmDiagnostics=1` opt-in.
- The TypeScript-aware graph guard distinguishes declaration-level and specifier-level type-only imports.
- Mixed imports retain their runtime value edges.
- Forbidden modules are checked one by one; the previous false-negative `not arrayContaining(all)` logic is gone.
- The default Vite/Chromium loaded graph excludes the diagnostic gate, product-gate harness/data, fixture, reviewed playback, smoke read model, and historical storage source.
- Default Worker outbound traffic is limited to `InitSession` and `RequestUiDetail`, with no normal-time `PlayerCommandBatch`, advance, or drain path.

Previously closed review findings remain covered:

- At 1424x861, real Playwright mouse input selects resident `1:1`, then resource `8:1`.
- Resource `8:1` is outside the HUD-covered area after local camera framing.
- Resource inspector semantics are `resource`, not structure/facility.
- Exact resource detail is `80 available, 0 reserved, 80 total` from the same authoritative basis.
- `WorldEntityKind.resource` is a presentation-only additive mapping through the read model, Pixi renderer, HUD, and en/zh-CN localization.
- An explicit unavailable selection clears instead of switching to an unrelated resident.
- Initial default selection and rapid resident/resource identity are tested separately.
- A reliable malformed-payload fatal clears the last frame and resets the assembler.
- Historical diagnostics/OPFS gates remain available only under explicit diagnostics mode.

Final checks reported by Canvas after `6eb4ab3`:

- Typecheck: pass
- Focused checks: 53/53 pass
- Web-shell E2E: 13/13 pass
- Worker smoke: 18/18 pass
- Quality: 458 tests pass
- Localization, boundaries, handoff, taskctl validation/status, and diff check: pass
- E2E-generated `coordination/reports/WM-0135-responsive-layout.md` drift was restored and is not part of the WM-0165 change

Residual risks recorded for review:

- `shell-bootstrap.ts` is still approximately 760 lines. Further responsible splitting requires a new approved production file; do not move product logic into historical diagnostics modules merely to reduce line count.
- A hard Worker transport crash still lacks a public `error` hook. The supported reliable fatal-message path is covered, but transport crash injection is not.
- GameSession save/load remains unsupported; no public save compatibility promise exists.

## Agent and thread ownership

All subagents are closed and consume no active concurrency slots.

- Client engineer / Canvas: `019f186b-f56d-73c0-8401-b9c7d8c8b5b2`
  - Current WM-0165 owner context.
  - Closed after committing `6eb4ab3` and pausing before `taskctl complete`.
- Systems architect / Keystone: `019f4af1-7783-70f2-b0d3-e19c3e0429e3`
  - Independent reviewer and blocker-resolution context for WM-0162 through WM-0165.
  - Closed after the last `changes_requested` review.
- Simulation engineer / Tally: `019f1882-5f86-7953-8725-0394c042cbf7`
  - Owner context for WM-0163 and WM-0164.
  - Closed; no current WM-0165 action.

Prefer reusing these exact threads. Do not spawn replacements unless resume/continue is genuinely unavailable.

## Exact resume procedure

The new root thread must first re-read:

1. `AGENTS.md`
2. `.agents/skills/wuming-town-agent-workflow/SKILL.md`
3. `coordination/tasks/WM-0165.json`
4. `coordination/reports/WM-0165-plan.md`
5. `coordination/reports/WM-0165.md`
6. `coordination/decisions/ADR-0017.md`
7. `docs/05_tech/12_integrated_gamesession_architecture.md`

Then verify, without changing state:

```powershell
git status --short --branch
git worktree list --porcelain
git log --oneline --decorate main..HEAD
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status
```

After the state matches this document:

1. Resume/reuse Canvas thread `019f186b-f56d-73c0-8401-b9c7d8c8b5b2`.
2. Ask Canvas to run only the final workflow transition:

```powershell
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs complete --id WM-0165 --agent client-engineer --summary "Closed the final source-isolation High: default diagnostics dependencies are dynamically gated behind wmDiagnostics=1, TypeScript-aware import graph and per-module runtime guards no longer false-green, while real resource/selection, focused, Web E2E, Worker smoke and full quality gates pass."
```

3. Confirm WM-0165 becomes `review_requested`; do not let Canvas review, integrate, merge, or push.
4. Route the review request with `taskctl route`, send it to Keystone `019f4af1-7783-70f2-b0d3-e19c3e0429e3`, and acknowledge only after routing.
5. Re-review only the final source-isolation High plus regression safety:
   - independent default Vite/Chromium loaded-module graph;
   - each forbidden module absent individually;
   - diagnostics mode still works;
   - 1424x861 resident-to-resource real mouse path still passes;
   - all required gates pass on `6eb4ab3`.
6. If `changes_requested`, return all findings to Canvas in one message and reuse the same two threads.
7. If `verified`, route/ack the approval to Canvas, close both agents, and commit all WM-0165 control-plane files separately.
8. Fast-forward merge the task branch into `main` only after verification.
9. Run every WM-0165 required check on exact main, including the full 13-test Web E2E and full quality gate.
10. Run `taskctl integrate`, then `taskctl done`; this should promote only `WM-0166`.
11. Commit the WM-0165 closure/WM-0166 promotion, validate a clean main, and push `origin/main`.
12. Continue with WM-0166 only after WM-0165 is done and pushed, using one active writer and one independent reviewer.

## Do not do

- Do not discard, stash, reset, or rewrite the dirty task/inbox files.
- Do not run `taskctl complete` from the project-director role; it belongs to the retained `client-engineer` claim.
- Do not merge or push WM-0165 before independent verification.
- Do not create another worktree for this task.
- Do not restore fixture authority, resource trends, needs classifications, UI-owned time, or synthetic canvas gameplay evidence.
- Do not expand WM-0165 into a broad UI redesign.
- Do not reopen the already integrated WM-0163/WM-0164 implementation unless a new verified regression requires it.

## Project-level context

- WM-0161 playable-product recovery roadmap: done and pushed.
- WM-0162 integrated GameSession architecture/DAG: done and pushed.
- WM-0163 GameSession core runtime: done and pushed.
- WM-0164 schema-v3 projection and continuous Worker session: done and pushed.
- WM-0165 default Web GameSession route: current paused task.
- WM-0166 remains proposed and must not be promoted or claimed until WM-0165 is done.
- WM-0154 remains a blocked historical visual-evidence task and is not the current critical path.

The new root thread should preserve the established resource discipline: one active writer, independent reviewer only after implementation completion, reuse existing agent threads, close idle agents promptly, and create no new linked worktree.
