# WM-0166 — PR-1 integrated GameSession exit gates

## 目标

以可重复的自动化证据验证 PR-1 integrated GameSession 的连续运行、同源读模型、Worker/headless parity、长跑守恒、静态 fixture 隔离与 schema-v3 fail-closed 门禁。

## 已读上下文

- `AGENTS.md`、workflow skill、WM-0166 task packet 与 `PLANS.md`
- ADR-0017、integrated GameSession architecture、playable recovery roadmap
- WM-0163、WM-0164、WM-0165 报告
- GameSession protocol/core/Worker tests、worker smoke 与 Web shell E2E

## 不做什么

- 不修改 `sim-protocol`、协议、schema 或存档格式。
- 不实现 PR-2+ 功能，不降低硬门槛，不扩展产品 UX 或发布面。
- 不把历史 fixture、scenario runner 或 drain helper 恢复为产品 authority。

## 当前事实与假设

- WM-0163..0165 已实现 runtime、schema-v3 Worker host 与默认 Web route；本任务独立验证并仅在 allowed paths 内强化门禁。
- 30 TPS 下 10 分钟等于 18000 ticks；真实 Worker-owned wall-clock 证据须由 Worker 测试覆盖，CLI 18000 ticks 只提供确定性长跑补充。
- 若现有实现无法满足硬门禁，将记录结构化 blocker/changes evidence，不改低阈值。

## 方案

审计现有门禁与 acceptance 映射，补齐缺失的 focused tests/机械 fixture 检查/首差异诊断；运行任务列出的全部 checks；恢复检查产生的 WM-0135 漂移；在报告中汇总复用 stores、M1-M8 未接入能力、残余风险与所有结果。

## 风险

- 10 分钟真实时间测试可能较慢或受主机调度抖动影响。
- 100000 tick 能发现守恒或队列泄漏，禁止以扩大容差掩盖。
- E2E 可能受浏览器环境影响，失败必须区分产品、测试基础设施和环境原因。
- quality 可能生成历史任务漂移，必须精确恢复且不触碰无关用户变更。

## 实施步骤

1. 建立 acceptance-to-test inventory，识别缺口。
2. 仅在 allowed paths 内补强测试、诊断与架构状态。
3. 运行 focused tests、Worker smoke、13 Web E2E、18000/100000 tick 与全部质量门禁。
4. 核对 diff、恢复 WM-0135 生成漂移、撰写 WM-0166 报告。
5. 提交 task branch，运行 `taskctl complete` 通知独立 reviewer。

## 测试与基准

严格执行 WM-0166 `requiredChecks` 全集；额外 focused 命令仅用于定位失败或验证新增门禁。

## 回滚

测试/文档增强可按 task branch commit 回退；不涉及产品 authority、协议或存档迁移。

## 完成条件

每条 acceptance 均有明确 PASS 或结构化 blocker 证据；全部 required checks 有真实结果；报告列全 PR-1 reused stores、未接入 M1-M8 能力与残余风险；提交后进入独立 review，不自行 review/integrate/done/merge/push。
