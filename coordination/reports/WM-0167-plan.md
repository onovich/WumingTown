# WM-0167 — PR-1 runtime lifecycle and Worker clock repair

## 目标

在不改变 100 ms / 3-tick publication quantum、协议、schema 或存档的前提下，使 PR-1 的显式非瞬时工作在真实 Worker publication 中稳定呈现 `moving -> working -> idle`，并使 Worker-owned normal-speed clock 能通过后续 600 秒 / 18000 tick 独立门禁。

## 已读上下文

- `AGENTS.md` 与 `wuming-town-agent-workflow`
- WM-0166 task、plan、report、reviewer changes-requested 与 blocker message
- ADR-0017 与 integrated GameSession architecture
- `game-session-job-lifecycle.ts`、`game-session-tick.ts`、`game-session-scheduler.ts`、`game-session-worker-host.ts`、Worker outbox/index 与 focused tests

## 不做什么

- 不修改 `packages/sim-protocol/**`、message family、schema 3、projection v1、validator、save 或公共兼容性。
- 不修改 Web 产品/E2E；它们归后续 WM-0168 独立证据任务。
- 不通过改变 100 ms quantum、每 quantum 3 ticks、600000 ms、18000 ticks 或 publication 数量门槛让测试变绿。
- 不引入 UI clock、advance/drain/command-drain 产品时钟、全局扫描、新 runtime dependency 或 PR-2+ 功能。

## 当前事实与约束

- 当前 `GameSessionJobLifecycle.acquireSelected()` 在 tick 0 写入 `moving`，同一 tick 的 `advanceActive()` 立即切到 `working`；两次 work tick 后在 tick 3 publication 前完成，因此外部只看见 idle。
- `JobCoreStore` 已有可序列化 `step`、`stepEnteredTick`、`stepTickCount` 与整数 Q16 progress；修复必须复用这些显式字段，不建立第二套隐式 cursor。
- 当前 Worker speed 1 每 100 ms 调用一次 3-tick quantum，但 scheduler 没有 wall-time debt；真实 600 秒生存与 cadence 证据由 WM-0168 独立执行。
- `sim-core` 只接收整数 tick；读取 wall clock 与 host timer 只能发生在 Worker scheduler 边界。

## 方案

1. 将 PR-1 最小 job 的移动与交互拆成由 JobCore step/tick 字段驱动的确定性阶段。每个 `moving` 与 `working` 阶段必须覆盖至少两个连续的 3-tick coherent publication pairs，再进入 terminal idle。
2. 保持 phase order、reservation ownership、structured reason、terminal release 与 hash input 同源；不在 projection/client 合成状态。
3. Worker scheduler 在 host 边界使用单调 wall-time debt 计算整数 tick 请求；catch-up 必须有明确单次上限并保留剩余 debt，不能在 `sim-core` 读取真实时钟，也不能丢 reliable messages。
4. 用 fake-timer/focused unit tests 验证速度、暂停、延迟 callback、bounded catch-up、shutdown/disconnect 与 backpressure；真实 wall-clock 证明留给 WM-0168。
5. 重新生成或更新仅因确定性 lifecycle 时长改变而变化的 focused hash assertions，并用 Worker/headless parity 与 100000-tick conservation 证明不是掩盖回归。

## 风险

- 阶段边界 off-by-one 会使状态只出现一次或仍被 3-tick quantum 跨过。
- 无界 catch-up 会阻塞 Worker；丢弃 debt 又会达不到 30 TPS / 18000 ticks。
- lifecycle 时长改变会合法改变固定 hash，必须同时证明两端 parity、结构化首差异与守恒。
- outbox/backpressure 改动可能误丢 reliable 消息或打乱 sequence。

## 实施步骤

1. 先写 focused failing probes，逐 publication 捕获 tick、sequence 与 resident activity，固定当前缺口。
2. 在 `game-session-job-lifecycle.ts` / 必要的 tick coordinator 边界实现显式 integer-tick 阶段，验证 JobCore snapshot 仍包含恢复所需 step/tick 字段。
3. 在 Worker scheduler/host/index 边界实现 bounded wall-time debt，并补速度、暂停、延迟、shutdown 与 disconnect tests。
4. 验证 latest-wins 与 reliable outbox 行为，禁止通过协议字段扩展取证。
5. 运行 task packet 全部 checks，写 WM-0167 report，提交后 `taskctl complete` 给独立 reviewer。

## 测试与基准

- Focused core/Worker tests 必须明确断言两个连续 `moving` publication pairs、两个后续连续 `working` pairs 与 terminal idle。
- Delayed scheduler tests 必须证明 debt 可追赶、单次 catch-up 有界、pause 不消耗世界 tick、resume 不回写世界历史。
- Worker/headless fixed-seed hashes、18000/100000 tick、conservation、boundaries 与 quality 全部通过。
- 本任务不把 fake timer 结果描述成 600 秒真实 Worker 证据。

## 回滚

可整体回退 WM-0167 产品 commit，恢复旧 lifecycle/scheduler 并保持 WM-0166 blocked；不得回滚到 UI authority、static fixture 或 drain clock。

## 完成条件

WM-0167 acceptance 逐条有测试或报告证据，所有 required checks 真实运行，diff 仅在 allowed paths，独立 reviewer verified 后由 project-director integrate/done；在此之前 WM-0168 不得 claim。
