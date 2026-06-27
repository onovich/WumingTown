# WM-0092 - Input and accessibility baseline

## Goal

Validate baseline keyboard and mouse input, UI scaling, bilingual text fit, reduced flashing, non-color cues and authority boundaries for M6 Web and Windows product-gate surfaces.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0092.json`
- `coordination/reports/WM-0083-future-m6-entry-prompt.md`
- `coordination/reports/WM-0084-m6-task-dag.md`
- `docs/01_design/05_ui_ux_information_design.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/06_engineering/05_testing_policy.md`
- `apps/web/**`
- `apps/desktop-electron/**`
- `packages/ui-react/**`
- `packages/renderer-pixi/**`

## Non-Goals

- No tutorial, localization overhaul, M7 public playtest work or audio system.
- No simulation authority change.
- No UI repair of authoritative state.
- No benchmark threshold change.

## Current Facts And Assumptions

- The Web product-gate shell already supports pointer selection, keyboard pan/zoom and read-only debug payloads.
- The UI includes English product-gate copy plus existing Chinese separator text, but WM-0092 needs explicit fit checks.
- Existing warning/stable states are partly textual, but alert severity should be exposed as a visible non-color cue and testable data attribute.
- There are no audio cues in the current M6 shell surface; this can be recorded as no-audio-currently rather than a missing visual alternative.

## Approach

1. Add visible alert severity labels and `data-alert-severity` attributes in `packages/ui-react/src/shell-hud.ts`.
2. Add Web shell e2e coverage for:
   - pointer select and keyboard pan/zoom;
   - desktop and compact viewport resize;
   - representative text fit and no horizontal document overflow;
   - English plus Chinese separator text presence;
   - no active document animations;
   - no audio/video cues;
   - non-color alert and storage/status cues.
3. Add desktop-shell e2e assertions for the same product surface basics from Electron.
4. Update UI/UX design notes with the WM-0092 baseline evidence and remaining audio status.
5. Write WM-0092 report and run required full e2e plus quality gates.

## Risks

- Text-fit checks can become brittle if they inspect every element; keep them to representative product-gate controls and panels.
- Accessibility scope can expand into full localization or tutorial work; keep WM-0092 to product-gate baseline evidence.
- Desktop e2e already builds the package; do not add extra package or release scope.

## Tests And Checks

- `pnpm typecheck`
- `pnpm test:e2e`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality`

## Rollback

Revert UI severity labels, e2e baseline assertions, docs and report. M6 product-gate decision would record input/a11y baseline as blocked.

## Done Conditions

- Web and Electron product surfaces have automated key/mouse and baseline accessibility evidence.
- Warning/stable states have visible non-color text cues.
- Representative compact and desktop layouts pass text-fit checks.
- No UI authority or simulation hash baseline changes are introduced.
