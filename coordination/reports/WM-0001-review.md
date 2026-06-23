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
