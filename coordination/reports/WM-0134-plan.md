# WM-0134 Plan

## Scope
- Keep locale preference in the app shell only; do not touch sim protocol, Worker state, save schema, or Electron bridges.
- Fix the current player-visible mixed-language leakage in the Web shell default HUD first.
- Keep diagnostics/dev English isolated behind `wmDiagnostics=1`.

## Execution plan
1. Read the task packet, WM-0130 audit, M8 locale contract, text-template guidance, and ADR-0011.
2. Add a narrow UI-side non-authoritative presentation adapter for the current Web shell fixture/read-model strings only.
3. Route `shell-hud.ts` player-visible fixture fields and input-feedback prose through the adapter or localization keys.
4. Localize the remaining obvious start-surface fixture identity fields that still surfaced from the same read model.
5. Extend localization validation so the current Web shell fixture cannot add new unaudited player-facing English source strings silently.
6. Add unit and `web-shell` e2e assertions that `zh-CN` HUD no longer shows the known fixture English words reported by Owner and WM-0130.
7. Run required checks, restore any refreshed WM-0118 artifacts because they are outside WM-0134 allowedPaths, then hand off to reviewer.

## Expected non-goals
- No change to sim-core, sim-worker, sim-protocol, or save/export schema.
- No claim that this localizes future content beyond the current Web shell fixture/read-model slice.
- No change to debug overlay copy other than keeping it outside the default player surface.
