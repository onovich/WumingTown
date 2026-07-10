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

## Reviewer findings 与串行 repair DAG（2026-07-11）

首次 review 为 `changes_requested`，因此原 report 的总体 PASS 结论不成立：真实 Chromium Worker 只运行到 tick >= 9，headless 18000 ticks 不能代替 600 wall-clock seconds；同时当前 lifecycle 在 tick 0 内从 moving 切到 working、tick 3 前完成，3-tick publication 只观察到 idle。

最小修复链严格串行，write-heavy width 保持 1：

1. `WM-0167`（simulation-engineer，ready）：只在列明的 sim-core/sim-worker production paths 修复显式 lifecycle 与 Worker clock；保持 100 ms / 3 ticks、协议/schema/save 不变。
2. `WM-0168`（qa-performance，proposed，depends on WM-0167）：只写 Worker/Web E2E、artifact 与 report，独立证明真实 module Worker `elapsed >= 600000 ms`、`tick delta >= 18000`、cadence/backpressure，以及 moving/working 各至少两个连续 coherent publications。
3. `WM-0166` 继续 blocked 并依赖 WM-0168；只有 WM-0167、WM-0168 都经过独立 reviewer verified、project-director integrated/done 后才可恢复。

Exact resume procedure：

1. WM-0167 `done` 后由 taskctl 将 WM-0168 promote ready，qa-performance 再 claim WM-0168。
2. WM-0168 `done` 后，qa-performance 运行 `taskctl unblock --id WM-0166 --agent qa-performance --summary "WM-0167 and WM-0168 done; resume full WM-0166 gates"`。
3. WM-0166 必须重新运行完整 `requiredChecks`、用新证据更新 report、再运行 `taskctl complete` 请求新一轮独立 review；不得复用旧 PASS 结论直接 review/integrate/done。

## 方案

审计现有门禁与 acceptance 映射，补齐缺失的 focused tests/机械 fixture 检查/首差异诊断；运行任务列出的全部 checks；恢复检查产生的 WM-0135 漂移；在报告中汇总复用 stores、M1-M8 未接入能力、残余风险与所有结果。

## 风险

- 10 分钟真实时间测试可能较慢或受主机调度抖动影响。
- 100000 tick 能发现守恒或队列泄漏，禁止以扩大容差掩盖。
- E2E 可能受浏览器环境影响，失败必须区分产品、测试基础设施和环境原因。
- quality 可能生成历史任务漂移，必须精确恢复且不触碰无关用户变更。

## 实施步骤

1. 保持 WM-0166 blocked，等待 WM-0167、WM-0168 按上述串行链完成。
2. 按 Exact resume procedure unblock，不跳过或并行 repair/evidence writer。
3. 恢复后重建 acceptance-to-test inventory，纳入真实 600 秒与 publication lifecycle artifact。
4. 运行 focused tests、Worker smoke、Web E2E、18000/100000 tick 与全部质量门禁。
5. 核对 diff、恢复检查生成的越界漂移、更新 WM-0166 report。
6. 提交 task branch，运行 `taskctl complete` 通知独立 reviewer。

## 测试与基准

严格执行 WM-0166 `requiredChecks` 全集；额外 focused 命令仅用于定位失败或验证新增门禁。

## 回滚

测试/文档增强可按 task branch commit 回退；不涉及产品 authority、协议或存档迁移。

## 完成条件

WM-0167 与 WM-0168 均已 done；每条 WM-0166 acceptance 均有明确 PASS 或结构化 blocker 证据；真实 Worker 600 秒与 moving/working publication artifact 可审计；全部 required checks 重新运行；报告列全 PR-1 reused stores、未接入 M1-M8 能力与残余风险；提交后进入新的独立 review，不自行 review/integrate/done/merge/push。
