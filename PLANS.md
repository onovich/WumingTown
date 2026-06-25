# Execution Plan 模板

复杂任务先创建 `coordination/reports/<TASK>-plan.md`，使用以下结构：

```markdown
# <TASK> — <标题>

## 目标

一句话说明用户可观察结果。

## 已读上下文

列出相关文档、模块、ADR 与既有测试。

## 不做什么

明确排除相邻需求。

## 当前事实与假设

区分已验证事实、设计决定和临时假设。

## 方案

数据流、接口、状态变更、失败处理、迁移方案。

## 风险

正确性、性能、兼容、内容、存档、Web、可解释性风险。

## 实施步骤

每一步必须有可验证输出，避免“一次重写全部”。

## 测试与基准

单元、场景、重放、E2E、性能或手工验证。

## 回滚

如何关闭、回退或迁移。

## 完成条件

与任务 acceptance criteria 一一对应。
```

# WM-0057 - M3 Save Replay Resume Harness

## Goal

Add a focused save/load/resume replay harness for
`m3.ordinary_life.injured_caregiver.v1` that proves the 12000 tick checkpoint
can load at 12001 and match uninterrupted replay through 36000.

## Read Context

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0057.json`
- `coordination/decisions/ADR-0008.md`
- `docs/02_systems/17_m3_ordinary_life_scenario.md`
- `docs/02_systems/13_save_replay_migration.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/06_engineering/03_definition_of_done.md`
- Existing M1/M2 save replay harnesses and diagnostics tools.

## Non-Goals

- No public save container or compatibility promise.
- No platform save UI, Worker protocol, schema migration, codec, dependency, or
  M4 scope changes.

## Approach

- Mirror the M2 focused harness pattern in a new `m3-save-replay.ts`.
- Snapshot M3 owner-state summaries from `runM3OrdinaryLifeScenario`, validate
  magic, versions, scenario id, section versions, owner handles, integer lanes,
  sorted records, command tail, and projection hashes before returning load
  success.
- Rebuild named derived surfaces in load output: needs, work offers,
  reservations, path caches, ability cache, mood/social read models,
  food/rest/medical indexes, weather/schedule projections, reason/metric
  materialization, and read models.
- Add focused tests for resume parity, validation failures, derived isolation,
  diagnostics, and command ids.
- Register `pnpm test --filter m3-save-replay` in `tools/test-runner.mjs` as a
  narrow allowed-path deviation required by the task packet.
- Extend replay diagnostics to support `--scenario m3-ordinary-life` and write
  WM-0057 artifacts.

## Checks

- `pnpm typecheck`
- `pnpm test --filter m3-save-replay`
- `pnpm sim:replay-test -- --scenario m3-ordinary-life`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- `pnpm quality` if feasible
