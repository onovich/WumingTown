# WM-0168 — PR-1 real Worker and default Web evidence

## 目标

在 WM-0167 独立验证并关闭后，以真实 Chromium module Worker 和默认 Web route 证明 600 秒 normal-speed 连续运行、cadence/backpressure，以及 3-tick quantum 下可观察的 `moving` / `working` publication lifecycle。

## 已读上下文

- `AGENTS.md` 与 `wuming-town-agent-workflow`
- WM-0167 task/report/review，以及 WM-0166 task/plan/report/reviewer blocker
- ADR-0017 与 integrated GameSession architecture
- `worker-smoke.e2e.test.ts`、`web-shell.e2e.test.ts` 和既有真实 browser Worker harness

## 不做什么

- 不修改任何 production file；产品失败必须结构化 block 回 `simulation-engineer`。
- 不用 in-process `HarnessBrowserWorker`、fake timer、headless explicit stepping、UI advance/wait/drain 或 command loop 代替 600 秒真实 Worker。
- 不降低 600000 ms、18000 ticks、5000 ms maximum publication gap、3-tick quantum 或连续 lifecycle publication 门槛。
- 不修改协议/schema/projection/save，不新增依赖，不推进 PR-2+ 或 release。

## 当前事实与约束

- WM-0166 现有 Chromium smoke 只到 tick >= 9；18000-tick CLI 是 headless explicit stepping，两者不能拼接成 600 秒 Worker 证据。
- 当前默认 Web route 已消费 coherent schema-v3 GameSession pairs，但旧证据没有捕获外部可见 `moving` / `working`。
- Real-time 测量可用 browser `performance.now()`，但该时钟只能属于 test harness，不进入 Worker authority 或 `sim-core`。

## 方案

1. 在真实 module Worker smoke 中 Init 一次 schema-v3 GameSession，Ready 后仅被动收集至少 600000 ms；记录 initial/final tick、每分钟 checkpoint、coherent publication 时间/序列、metrics 与 fatal/closed。
2. 门禁要求至少前进 18000 ticks、每个 60 秒窗口有推进、最大 coherent publication gap <= 5000 ms、tick/sequence 严格递增且 basis coherent。
3. 从同一真实 Worker publication stream 证明 `moving` 至少连续两对、随后 `working` 至少连续两对，再到 terminal idle；禁止 fixture 或 test-side 状态合成。
4. 默认 Web E2E 被动观察独立 moving/working frames、同一 GameSession basis、8 residents/resources/details 与 `projectionSource=game-session-worker`，并机械检查 bootstrap 不调用 fixture/advance/wait/drain authority。
5. 写紧凑 JSON artifact 与 report；记录聚合数据而非巨量逐帧日志。重跑 parity、18000/100000 tick、schema fail-closed、boundaries 与 quality。

## 风险

- 测试真实耗时超过十分钟，Vitest timeout 必须高于证据窗口但不能缩短窗口。
- 浏览器/主机挂起会形成 >5000 ms gap；这应作为失败证据，不得用容差隐藏。
- 600 秒测试若与其他 write-heavy work 并行会污染资源结果；DAG 保持 width=1。
- Web E2E 若发现产品缺口，QA 不得越权修复。

## 实施步骤

1. 核对 WM-0167 为 `done`，再通过 `taskctl claim` 认领 WM-0168。
2. 先补 lifecycle/cadence collector 与 compact summary，再运行一次完整 600 秒真实 Worker gate。
3. 补默认 Web passive publication assertions，运行 worker-smoke 与 web-shell 全集。
4. 重跑 fixed-seed parity、18000/100000 tick、schema/quality/control-plane gates。
5. 写 artifact/report，提交并 `taskctl complete`；由独立 reviewer 复核真实 elapsed evidence。

## 测试与基准

- 真实 Worker：elapsed >= 600000 ms，tick delta >= 18000，10 个 minute windows 均推进，max gap <= 5000 ms，无 fatal/closed。
- Lifecycle：`moving x2+ -> working x2+ -> idle` coherent pairs，100 ms / 3 ticks 未变。
- Backpressure：报告 real-run metrics，并引用 focused forced-backpressure latest-wins/reliable ordering evidence。
- Web：默认 1424 x 861 route 的真实 Worker projection frames 与 authority source。

## 回滚

E2E 与 artifact 可按 WM-0168 commit 回退；产品代码不在本任务中。失败时保留 WM-0166 blocked 并发送结构化 blocker，不删除失败证据。

## 完成条件

所有 acceptance 与 required checks 有可审计结果，artifact/report 含精确 wall-clock/cadence/lifecycle/backpressure 数据，独立 reviewer verified 后由 project-director integrate/done；只有随后才可按 WM-0166 resume procedure 解锁原任务。
