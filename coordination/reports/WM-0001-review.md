# WM-0001 Review

Reviewer: reviewer / Mirror
Verdict: changes_requested
Reviewed at: 2026-06-23

## Findings

### High - Task branch has no tracked adoption diff

The task branch is not reviewable or integrable as submitted. `git status --short --branch` shows the repository is on `task/WM-0001-adopt-control-plane`, but the entire adopted handoff corpus, workflow skill, reports, task JSON, and validation tools are untracked. `git log --oneline --decorate --all --stat --max-count=8` shows `HEAD`, `main`, and `task/WM-0001-adopt-control-plane` all point to the same baseline commit, `e9578ee`, which contains only the original handoff ZIP and `.sha256` file. Both `git diff --stat main...task/WM-0001-adopt-control-plane` and `git diff --stat main..HEAD` are empty.

This blocks verification because the reviewer cannot inspect a real branch diff, and a clean checkout of the task branch would not contain `tools/validate-handoff.mjs`, `.agents/skills/wuming-town-agent-workflow/`, `coordination/tasks/`, or the adopted documentation. The quality gate requires the independent reviewer to inspect real diff and evidence before verification, and the WM-0001 acceptance depends on the adopted control plane being present in the branch.

Required fix: commit or otherwise make the intended adopted corpus and coordination evidence part of the task branch, then rerun the required validation commands from that tracked state.

### Medium - Recorded validation evidence is stale after workflow mutations

The report records `node tools/validate-handoff.mjs` as passing with `165 files` and structure digest `8262f6cdfd297cb3db0968b06cb149eea7c65aeb4ec331216a2262d3eefa5738`. During review, the same command passed with `168 files` and structure digest `01204d7a2cd4439d3a3960ab8b6a62693ee5b7b977ed8082ddbedfc4057cf2ac`.

The report also records a checksum inspection after claim with one expected mismatch, `coordination/tasks/WM-0001.json`; review-time inspection found two mutable coordination mismatches: `coordination/tasks/WM-0001.json` and `coordination/thread-registry.json`. These appear to be expected workflow mutations, but the final report should identify the final mutable files and final validation outputs after completion/routing so acceptance evidence matches the state being reviewed.

## Commands Run

- `git status --short --branch`
- `git diff --stat main...task/WM-0001-adopt-control-plane`
- `git diff --stat main..HEAD`
- `git diff --cached --stat`
- `git log --oneline --decorate --all --stat --max-count=8`
- `git ls-files`
- `git status --porcelain=v1 -uall`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- checksum verification against `CHECKSUMS.sha256`
- manifest and task-state inspection with Node

## Positive Evidence

- `node tools/validate-handoff.mjs` passes in the current working tree.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate` passes in the current working tree.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status` reports 11 proposed tasks and WM-0001 in `review_requested`.
- Locked product decisions inspected in `CODEX_START_HERE.md`, `docs/00_project/05_decision_register.md`, and `coordination/project-state.json` remain consistent with the submitted report; no product implementation code exists in the tracked branch.

## Verdict Summary

Changes requested: High Git tracking/integration blocker; Medium final evidence drift. Do not verify WM-0001 until the adopted control plane and final reviewable evidence are present in the task branch.

---

# WM-0001 Re-Review

Reviewer: reviewer / Mirror
Verdict: verified
Reviewed at: 2026-06-23

## Findings

No blocking findings.

The previous high finding is resolved: `task/WM-0001-adopt-control-plane` now has a tracked adoption diff from `main`, with 171 added files and 6959 insertions. `HEAD` is `760327922d74456f8be4152ee247e2dcc1bd82f6`, with the task branch three commits ahead of baseline `main` commit `e9578ee3f2d65480a3e8f630cbb0c728b96ef11a`.

The previous medium finding is resolved for verification purposes: the report now classifies checksum and validator digest drift as expected mutable control-plane behavior, and re-review commands confirm the current tracked state passes required validators.

## Commands Run

- `git status --short --branch` -> clean on `task/WM-0001-adopt-control-plane` before review evidence update.
- `git rev-parse HEAD` -> `760327922d74456f8be4152ee247e2dcc1bd82f6`.
- `git diff --stat main...task/WM-0001-adopt-control-plane` -> non-empty tracked adoption diff, 171 files changed.
- `git diff --name-status main...task/WM-0001-adopt-control-plane` -> adoption files are tracked additions.
- `git log --oneline --decorate --all --max-count=8` -> task branch commits sit on baseline `main`.
- `node tools/validate-handoff.mjs` -> passed: 171 files, 12 tasks, 9 roles; digest `07633bde45710744363430f6a459b8424e4a4fb8e0420e9e83f9460da7ae8fa5`.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate` -> passed: 12 tasks, 9 roles.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status` -> proposed 11, review_requested 1, unread inbox 0.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs route` -> no messages require routing.
- `CHECKSUMS.sha256` inspection -> 163 entries, 0 missing, expected mutable mismatches only for `coordination/tasks/WM-0001.json` and `coordination/thread-registry.json`.
- ZIP hash verification -> original archive hash matches the recorded `.sha256` value.
- UTF-8 BOM check -> `SKILL.md` starts `45 45 45`; `agents/openai.yaml` starts `105 110 116`.
- `git diff --check main...task/WM-0001-adopt-control-plane` -> only Markdown trailing spaces in `README.md`, allowed by `.editorconfig` for `*.md` and not a verification blocker.

## Acceptance Review

| Acceptance criterion | Re-review evidence |
|---|---|
| `taskctl validate` and handoff validator pass | Both pass in the tracked branch state. |
| A report lists every discovered contradiction or states that none were found | `coordination/reports/WM-0001.md` records manifest/file-count nuance, checksum drift, skill discovery limitation, routing limitation, and operational risks. |
| M0 execution plan assigns ownership without exceeding three concurrent write-heavy tasks | `coordination/reports/WM-0001-plan.md` and `coordination/reports/WM-0001.md` dispatch WM-0002 first, then at most WM-0003, WM-0005, and WM-0009 as concurrent write-heavy lanes. |
| No locked decision is silently changed | Locked decisions in `CODEX_START_HERE.md`, `docs/00_project/05_decision_register.md`, and `coordination/project-state.json` remain aligned: TypeScript-first, Dedicated Worker authority, PixiJS world rendering plus React UI, Windows/Web first, 30 TPS, no early Rust rewrite, no arbitrary code mods. |

## Residual Notes

The `tools/validate-handoff.mjs` structure digest is intentionally volatile because coordination reports and inbox messages are part of the validator walk. Integration should rerun the same validators after the `verified` state transition because `taskctl review` will mutate `coordination/tasks/WM-0001.json` and add a project-director inbox message.

## Verdict Summary

Verified: no blocking findings; acceptance evidence confirmed after tracked adoption diff and refreshed validation evidence.
