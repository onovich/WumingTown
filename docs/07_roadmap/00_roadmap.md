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

## M4 Planning Addendum

WM-0061 creates the reviewed-planning candidate package for M4. The package
defines scenario contract
`m4.core_vertical_slice.borrowed_shadow_lamps.v1`, ADR-0009, and proposed task
packets WM-0062 through WM-0071. M4 runtime implementation remains unstarted
until WM-0061 is independently reviewed and integrated, and the project-director
promotes downstream ready tasks through taskctl.

M4 planning preserves the M3 closeout baseline and keeps the benchmark policy:
P95 regression over 10 percent requires explanation, and over 20 percent blocks
merge by default. WM-0061 does not create, promote, claim, implement, or review
any M5 task.

## M4 Closeout Addendum

WM-0071 closes the M4 core vertical slice gate after reviewed integration of
WM-0062 through WM-0070. The closeout evidence records the focused
borrowed-shadow lamp rule-discovery scenario
`m4.core_vertical_slice.borrowed_shadow_lamps.v1` with requested seed `4`,
authoritative scenario seed `50`, content hash `0x698f2c41`, command stream
hash `0x538d0e43`, 36000-tick final world hash `0xc201a925`, and 100000-tick
final world hash `0xdafa3b25`.

M4 is a core product-loop vertical slice for lamp-network rule fields,
Chronicle evidence, obligations, town rules, borrowed-shadow crisis state,
director recovery windows, structured dawn review, focused save/replay,
Worker/headless parity, and benchmarked long-run invariants. It is not M5
alpha content framework, broad anomaly roster, faction campaign, governance
simulation, season event pool, data-mod production, platform save UI or public
save compatibility.

The reviewed M4 benchmark artifact is
`coordination/artifacts/WM-0070/benchmarks/benchmark-results.json` with actual
file SHA-256
`FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`.
Benchmark warning/blocking thresholds remain 10 percent and 20 percent.

M5 remains unstarted by this closeout. WM-0071 writes only the non-executable
future handoff prompt at
`coordination/reports/WM-0071-future-m5-entry-prompt.md`; a later reviewed M5
planning task must create any M5 DAG before implementation can begin.

## M5 Planning Addendum

WM-0072 creates the reviewed-planning candidate package for M5. The package
defines scenario contract `m5.alpha_content_framework.first_season.v1`,
ADR-0010, roadmap plan and proposed task packets WM-0073 through WM-0083.
Runtime M5 implementation remains unstarted until WM-0072 is independently
reviewed and integrated, and the project-director promotes downstream ready
tasks through taskctl.

M5 planning preserves the M4 closeout baseline, including the M4 benchmark
artifact
`coordination/artifacts/WM-0070/benchmarks/benchmark-results.json` with actual
file SHA-256
`FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`.
Benchmark warning/blocking thresholds remain 10 percent and 20 percent.

WM-0072 does not create, promote, claim, implement or review any M6 task. M6
readiness is represented only as stop signs inside the M5 plan.

## M6 Closeout Addendum

WM-0097 closes M6 as the Web / Windows Product Gate after reviewed integration
of WM-0085 through WM-0096 and independent review of the final closeout. The
M6 Web verdict is `demo-only`: Web remains a formal gated target, but the
current evidence does not prove same-spec, lower-fast-forward or lower-cap
browser support because the browser path is a product-gate shell plus Worker
projection path rather than a measured 30 TPS / 20k-entity browser authority
runtime.

The M6 Windows verdict is `ready-for-controlled-external-test` as an unsigned
unpacked local directory build. This covers controlled testing of launch,
rendering, input, sandbox/preload boundaries, product-gate surfaces and
diagnostic-blocker behavior. It does not approve installer, signing, updater,
store submission, public release, telemetry, account services, crash upload or
paid services.

M6 closeout preserves the M5 alpha content final world/read-model hashes
`0xfba70a5c` / `0x9ba83cb7` and the benchmark threshold policy of 10 percent
warning and 20 percent blocking regression. Web OPFS save/export/import and
safe local diagnostics are covered; Windows/Web save-container
interoperability and Windows host-side diagnostic package writing remain
explicit blockers until reviewed narrow desktop bridges exist.

M7 remains unstarted by this closeout. WM-0097 writes only the non-executable
future handoff prompt at
`coordination/reports/WM-0097-future-m7-entry-prompt.md`; a later owner-sent M7
goal must create or follow a reviewed M7 task DAG before any M7 implementation
task is claimed.

## M7 Planning Addendum

WM-0098 starts M7 planning from the verified WM-0097 future M7 entry prompt.
The planning package defines M7 as Early Access / public playtest preparation
and creates proposed WM-0099 through WM-0110 task packets covering tutorial
onboarding, early-game balance/readability, cultural review, privacy/feedback/
diagnostics, Windows controlled external test instructions, Web demo-only
scope, save compatibility policy, draft store/playtest materials, known issues
and release notes, playtest checklist, readiness decision, and M7 closeout with
a future M8 prompt.

M7 planning preserves current Roadmap authority: M6 is Web / Windows Product
Gate, M7 is Early Access / public playtest preparation, and M8 is 1.0. Old
M6/M7/M8/M9 inferences remain deprecated. M7 implementation does not start
inside WM-0098, and downstream packets remain proposed until WM-0098 is
independently reviewed, integrated and marked done.

Web remains `demo-only`; Windows remains `ready-for-controlled-external-test`
as an unsigned unpacked local directory build. Public release, Early Access
launch, store submission, public Web launch, signing, installer/updater
distribution, telemetry, accounts, hosted services, paid services, public
feedback systems, final privacy/legal/store claims and public save
compatibility commitments remain owner-gated. M8 remains unstarted.

## M7 Closeout Addendum

WM-0110 closes M7 as Early Access / public playtest preparation after reviewed
integration of WM-0098 through WM-0109 and independent review of the final M7
closeout. The closeout records that M7 produced first-run onboarding, early
balance/readability evidence, cultural review and terminology safety, local
privacy/feedback/diagnostics boundaries, Windows controlled external test
instructions, Web demo-only scope, save compatibility policy draft, non-final
store/playtest material draft, known issues and release notes, tester protocol
and the M7 readiness matrix.

M7 readiness remains preparation rather than launch approval. Early Access and
public playtest materials are prepared for owner review, but public release,
Early Access launch, public recruitment, store submission, public Web launch,
signing, installer/updater distribution, telemetry, accounts, hosted services,
paid services, public feedback systems, final privacy/legal/store claims and
public save compatibility commitments remain owner-gated.

The M6 verdicts remain unchanged: Web is `demo-only`, and Windows is
`ready-for-controlled-external-test` as an unsigned unpacked local directory
build. M7 preserves the M5 alpha content final world/read-model hashes
`0xfba70a5c` / `0x9ba83cb7` and the benchmark threshold policy of 10 percent
warning and 20 percent blocking regression.

M8 remains unstarted by this closeout. WM-0110 writes only the non-executable
future handoff prompt at
`coordination/reports/WM-0110-future-m8-entry-prompt.md`; a later owner-sent M8
goal must create or follow a reviewed M8 task DAG before any M8 implementation
task is claimed.

## M8 UI / I18n Scope Amendment Addendum

WM-0111 starts M8 planning from the verified WM-0110 future M8 prompt and the
Owner amendment `OWNER-AMENDMENT-2026-06-27-UI-I18N-PRODUCTIZATION`. The
amendment does not change the Roadmap's M8 = 1.0 definition, but makes product
UI, responsive layout, zh-CN/en localization, visual identity, first-play
guidance and accessibility mandatory M8 gates.

The M8 planning package must preserve current platform verdicts: Web remains
`demo-only`, and Windows remains `ready-for-controlled-external-test` as an
unsigned unpacked local directory build. Public release, 1.0 release, store
submission, public Web launch, signing, installer/updater distribution,
telemetry, accounts, hosted services, paid services, public feedback systems,
final privacy/legal/store claims and public save compatibility commitments
remain owner-gated.

M8 implementation remains unstarted until WM-0111 is independently reviewed,
integrated and marked done, and downstream packets are promoted through
taskctl.
