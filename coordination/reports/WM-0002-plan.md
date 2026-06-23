# WM-0002 - Bootstrap the TypeScript monorepo and quality gates

## Goal

Create an installable, pinned pnpm TypeScript monorepo skeleton whose root quality gates prove package boundaries, strict typing, linting, formatting, unit smoke tests, and content-validation entry points.

## Read Context

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `coordination/tasks/WM-0002.json`
- `PLANS.md`
- `docs/05_tech/00_tech_stack.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/06_engineering/00_coding_standard.md`
- `docs/06_engineering/06_dependency_security_policy.md`
- `docs/07_roadmap/00_roadmap.md`
- `docs/07_roadmap/01_milestones_and_quality_gates.md`
- `docs/08_codex/00_multi_agent_operating_model.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `.agents/skills/wuming-town-agent-workflow/references/protocol.md`
- `.agents/skills/wuming-town-agent-workflow/references/task-schema.md`
- `.agents/skills/wuming-town-agent-workflow/references/quality-gates.md`

## Non-Goals

- No gameplay, simulation, AI, job, save, renderer, Worker protocol, Electron shell, content compiler behavior, or product UI behavior.
- No new runtime feature dependency beyond toolchain packages required to enforce WM-0002 gates.
- No Spark dispatch and no final self-review.

## Current Facts And Assumptions

- Verified worktree: `D:/WebProjects/WumingTown-WM-0002`.
- Verified branch: `task/WM-0002-bootstrap-monorepo`.
- `pnpm-workspace.yaml` already includes `apps/*`, `packages/*`, and `tools/*`.
- `package.json` currently contains only handoff/coordination scripts; WM-0002 must add real root gates.
- Assumption: package skeletons may expose tiny smoke constants/functions only when needed for typecheck/test/boundary validation.

## Approach

1. Freeze the workspace topology from `docs/05_tech/01_technical_architecture.md`.
2. Add root TypeScript, ESLint, Prettier, Vitest, content validation, and package-boundary commands.
3. Create minimal package/app/tool workspaces with public `src/index.ts` exports and no deep runtime behavior.
4. Add a custom boundary guard so dependency direction is enforceable without relying on reviewer memory.
5. Add CI skeleton that runs the same root gates.
6. Record pinned tool versions and boundary decisions in an ADR.

## Risks

- Correctness: accidental deep imports or reversed dependencies could pass typecheck unless the boundary guard covers all workspaces.
- Scope: smoke files must remain skeletal and avoid implementing later runtime contracts.
- Security: dependency versions must be exact and lockfile-backed.
- Compatibility: Node 24/pnpm 11 versions must be pinned while still usable by CI.

## Implementation Steps

1. Add/update root config files and exact devDependencies.
2. Add workspace directories and minimal package manifests/source/test files.
3. Add `tools/content-cli` and `tools/headless-runner` as skeletal workspaces only.
4. Add boundary/content validation scripts.
5. Add CI workflow and ADR.
6. Run install and all required gates; fix only WM-0002 scope failures.

## Tests And Baselines

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- New root content validation command
- New root boundary check command
- `node tools/validate-handoff.mjs`
- `taskctl validate/status`

## Rollback

Revert the WM-0002 branch changes for workspace/config/tooling files and rerun `taskctl validate`; no save data or product runtime state is introduced.

## Done Conditions

- Workspace contains the architecture-approved apps/packages/tools.
- Root gates run typecheck, lint, format check, unit tests, content validation, and package boundary enforcement.
- Tool versions are exact, lockfile-backed, and documented in an ADR.
- Smoke tests prove wiring only, with no product runtime behavior beyond skeleton validation.
