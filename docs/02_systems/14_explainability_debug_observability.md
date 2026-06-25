# 可解释性、调试与可观测性

## 同源原则

玩家解释、开发调试和测试断言读取同一结构化原因，不维护三套逻辑。

## ReasonTrace

每次重要选择可生成有容量限制的 Trace：候选数量、过滤阶段、评分项、最终选择、拒绝原因。默认只保留关键角色最近记录，开发模式可扩展。

## 覆盖层

- Region/Room/可达性
- 灯势与人类秩序边界
- WorkOffer 和 Reservation
- 路径与版本
- 温度/危险/异类影响
- 证据痕迹和居民知识范围
- Dirty Queue 与 Chunk 重建

## 性能面板

每系统耗时、调用数、实体数、候选数、分配估计、队列长度、最慢实体、快照大小和 Worker 延迟。所有新系统必须注册指标。

## 开发命令

生成角色/资源、强制事件、熄灭灯、添加证据、修改债务、推进时间、验证不变量、导出重放、运行场景。

## 事故复盘

正式游戏的黎明复盘显示结构化时间线、规则证据、镇规违反、角色决定和可避免环节。它既是玩法，也是调试成果的产品化。

## WM-0024 implementation note

`ReasonTraceStore` is a fixed-capacity ring buffer for work-offer selection
diagnostics. Each trace records the pawn id, composite query key, total bucket
candidate count, visited/scored count, candidate and selected caps, selected
offer id/score, candidate-cap rejection count and semantic reason class.

Runtime selection writes compact numeric lanes; debug/test reads can materialize
structured views. Default task coverage uses a 16-trace store, matching the M1
scenario contract's bounded latest-trace expectation.

## WM-0036 implementation note

WorkOffer traces now include both candidate-cap and selected-cap rejection
counts plus a compact rejection mask. The materialized trace view exposes the
same shared data used by tests and benchmark diagnostics: candidate total,
visited count, scored count, caps, selected offer id, selected score, rejection
classes and semantic reason. This keeps explanation logic in sim-core data
instead of adding UI-only interpretation.

For the focused M2 20-pawn evidence, `ReasonTraceStore` capacity is `64` and
the selector writes one trace per pawn selection pass. Trace rows are bounded
diagnostics, not job cursors, save authority, reservation owners or queues that
can grow with world size.

## WM-0025 implementation note

`JobCoreStore` stores job failure and interruption outcomes as structured
numeric lanes that materialize to reason classes: permission, material,
reservation, path, risk, time, target-state and cancelled. These are shared by
complete/fail/cancel/interruption paths instead of being UI-only explanation
strings.

The job snapshot hash helper exposes deterministic fields for replay and debug
comparison. Later scenario traces can reference these job reason classes
without duplicating separate explanation logic.

## WM-0039 implementation note

M2 build/order scaffolding uses the same structured reason vocabulary in code,
tests and reports. Focused coverage now distinguishes missing materials
(`material.insufficient_required_amount`), invalid or terminal targets
(`target.invalid_state`), blocked placement (`site.blocked`), material capacity
or reservation conflicts (`reservation.destination_capacity_conflict`), path
failure (`path.no_route_to_destination`) and policy denial
(`policy.interruption_denied`).

`BuildSiteOrderView` is a compact debug/read-model surface for order panels and
tests. It is derived from build-site owner state and exposes demand, reserved
capacity, progress and active-offer flags without becoming an authority for job
state, material quantities or WorkOffer membership.

## WM-0041 implementation note

M2 Worker/headless parity diagnostics compare browser Worker and Node
authoritative hashes for `m2.work_logistics.lantern_yard.v1` without adding UI
world mutation. Worker `RenderSnapshot`, `UiDelta` and `MetricsSample` payloads
carry the same scenario id, world hash and read-model hash derived from
sim-core projections, with `readOnly: true` on render/UI surfaces.

Focused parity tests also build a deterministic diagnostic record containing
seed, scenario id, first mismatched checkpoint tick, final snapshot size and
Worker message latency count. These diagnostics are test/report evidence, not
authoritative owner state and not a persisted cache.
