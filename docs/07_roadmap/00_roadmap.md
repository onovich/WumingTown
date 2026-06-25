# 项目 Roadmap

Roadmap 以能力门禁而非日期承诺组织。任何阶段未过门禁，不得用更多内容掩盖基础问题。

## M0 — Agent-ready 工程骨架

目标：仓库、CI、任务协调、技术 Spike 和规范可执行。

交付：pnpm monorepo、apps/packages 骨架、严格 TS、Lint/format/test、Web/Electron 空壳、Worker ping、Headless runner、性能记录、内容 Schema CLI、Codex Skill 验证。

门禁：一条命令完成安装/类型/测试/构建；Windows 和 Chrome smoke；无编辑器隐式步骤。

## M1 — 模拟内核

EntityId、Store、固定 Tick、PRNG、Command Buffer、事件阶段、世界 Hash、基本地图与 Snapshot。

门禁：Headless 100k Tick 可复现；浏览器 Worker 与 Node 同 Hash；50k 空实体无队列/内存持续增长。

## M2 — 工作与物流垂直切片

Region/A\*、WorkOffer、Job Driver、Reservation、物品、存储、搬运、建造、生产订单、原因解释。

门禁：10 个角色长期搬运建造不争抢、不泄漏；存档中断恢复；100 路径压力基准。

## M3 — 普通生活模拟

需求、休息、食物、伤病、医疗、能力、情绪、关系、日夜、天气基础。

门禁：一次受伤能影响工作、医疗、物流、情绪和关系；全部可解释。

## M4 — 《无明镇》核心垂直切片

灯网、黄昏总览、镇志证据、镇规、借影客、旧债、黎明复盘、导演恢复窗口。

门禁：玩家可在无攻略下理解至少一条规则；完整危机链可保存/重放；事故后原因链清楚。

## M5 — Alpha 内容框架

3 种异类、4 派系、基础治理、20–30 建筑、第一轮完整季节与事件池、数据模组。

门禁：10 小时局内无结构性死锁；四种策略均可生存；内容添加主要通过数据。

## M6 — Web/Windows 产品门禁

性能、内存、加载、存档、输入、可访问性、打包安全与崩溃报告。

门禁：决定 Web 同规格、缩放、试玩或取消；Windows 形成可外测构建。

## M7 — Early Access/公开试玩准备

教程、平衡、文化审查、隐私、商店材料、反馈与存档兼容承诺。是否 Early Access 由产品方后续决定。

## M8 — 1.0

12–15 异类、完整派系/终局、稳定模组、性能与长时存档、内容与本地化完成。

## M1 Closeout Addendum

WM-0030 closes the M1 simulation-kernel gate after reviewed integration of
WM-0014 through WM-0029. The closeout evidence records the 100000-tick
hauling/building headless run with final world hash `0xf7815189`, browser
Worker/Node parity for the same scenario, the 50000-entity spatial-index
pressure benchmark, and the final benchmark artifact comparison. M2 has not
started; the next phase requires a fresh reviewed M2 plan and task DAG before
any product implementation begins.

## M2 Closeout Addendum

WM-0043 closes the M2 work/logistics vertical-slice gate after reviewed
integration of WM-0033 through WM-0042. The closeout evidence records the
100000-tick M2 work/logistics headless run for
`m2.work_logistics.lantern_yard.v1` with seed `2`, final world hash
`0x9e689c8d`, 20 participating actors, four completed build orders, zero
terminal reservations/offers/running jobs, save/resume parity, browser
Worker/Node parity, and benchmark-backed 100-path invalidation evidence with 20
stale rejects.

M2 is a simulation capability milestone, not a broad economy, town-life, UI
construction, platform save, anomaly, combat or content-production milestone.
M3 remains unstarted: no M3 task was created, promoted, claimed or implemented
by this closeout.

## M3 Closeout Addendum

WM-0060 closes the M3 ordinary-life simulation gate after reviewed integration
of WM-0046 through WM-0059. The closeout evidence records the focused
ordinary-life scenario `m3.ordinary_life.injured_caregiver.v1` with requested
seed `3`, authoritative scenario seed `46`, command stream hash `0x226832d2`,
content hash `0xdfe7107e`, long-run final world hash `0x7eb81a69`, and final
read-model hash `0x82bf87d6`.

M3 is a simulation capability milestone for needs, day/night/weather basics,
rest, food, injury, medical care, ability cache invalidation, mood, thoughts,
relationships, focused save/replay, Worker/headless parity, and benchmarked
long-run invariants. It is not M4 lamp network, Chronicle evidence gameplay,
obligations, anomaly/crisis/director work, product dawn replay, broad economy,
platform save UI, or public save compatibility.

M4 remains unstarted by this closeout. WM-0060 writes only the non-executable
future handoff prompt at
`coordination/reports/WM-0060-future-m4-entry-prompt.md`; a later reviewed M4
planning task must create any M4 DAG before implementation can begin.
