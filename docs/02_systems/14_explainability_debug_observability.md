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
