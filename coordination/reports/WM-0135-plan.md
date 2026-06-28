# WM-0135 Plan

## Scope

Implement the post-M8 responsive layout gate for the Web player shell within the
approved UI/rendering paths. Keep the work presentation-only: React and Pixi may
reshape HUD panels, hit regions and evidence capture, but they must not mutate
authoritative world state, release verdicts, save schema or platform status.

## Baseline Read

- WM-0130 identified that prior responsive evidence was reachability-oriented:
  panels could be scrolled into view, but small and medium windows did not prove
  a playable simultaneous composition.
- WM-0131 requires B-derived layout anchors: top bar, resident/summary rail,
  central Pixi map, inspector and command access. At `1280x720` and `1366x768`,
  side rails may collapse into drawers or tabs as long as phase, resources, map
  and command access remain reachable.
- Current `shell-hud.ts` has only desktop and compact modes. The compact cutoff
  is below `1040px`, so `1280x720`, `1366x768` and `1424x861` still use the
  dense desktop three-column overlay.

## Planned Changes

1. Add an explicit responsive HUD layout mode:
   - `desktop` for wide/tall viewports;
   - `medium` for required windowed sizes where rails collapse into a bottom
     HUD drawer plus an inspector rail;
   - `compact` for narrow/mobile-like viewports.
2. Keep map interaction space visible in medium mode by avoiding full-height
   left/right rail coverage, using stable bottom scroll regions for long labels.
3. Add data attributes and DOM metrics that let reviewers distinguish desktop,
   medium and compact layout evidence without relying on screenshots alone.
4. Strengthen the responsive E2E matrix so en and zh-CN player HUD states prove
   required viewport sizes, no document overflow, stable scroll regions, and a
   map focus area not incoherently covered by panels.
5. Store reviewer-inspectable DOM-layout evidence in a WM-0135 report artifact
   path, while avoiding unrelated WM-0118 artifact churn unless explicitly
   needed for the test runner.

## Verification Plan

- `corepack pnpm test:e2e -- --grep responsive` if supported, otherwise record
  the repository command-shape result and run the supported web-shell E2E.
- `corepack pnpm test --filter web-shell` and record the known unit-filter
  limitation if it remains unsupported.
- `node tools/test-runner.mjs e2e --filter web-shell`
- `corepack pnpm typecheck`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `corepack pnpm quality`
