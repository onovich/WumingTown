# 地图、空间、房间与灯火

## 地图数据

地图是连续并行网格，不是对象二维数组：

```text
Terrain, Occupancy, Roof, RegionId, RoomId, WalkCost,
LightInfluence, LanternClaim, Temperature, Moisture,
Gas/Pollution(后续), Fire, EvidenceTrace
```

MVP 128×128；Chunk 建议 32×32。技术压力目标 256×256。

## 局部失效

墙、门、灯或地形变化只标记受影响 Chunk/Region。每个网格有版本号、脏队列和每 Tick 重建预算。完整重算只用于加载、调试或版本恢复。

## Region 与 Room

Region Graph 用于粗粒度可达性、工作搜索和路径。Room 用于室内外、舒适、温度、隐私和部分异类规则。门状态变化可改变 Region 连通，但不得同步重建全图。

## 灯火模型

灯火不是像素光照真值，而是规则场：

- `visualLight`: 表现亮度，可由 GPU 插值。
- `humanClaim`: 人类秩序强度，权威模拟整数场。
- `lanternTags`: 家灯、路灯、守夜灯、引魂灯、客灯、禁灯。
- `maintenance`: 燃料、灯芯、损坏、守灯职责。

灯的影响由空间衰减、阻挡、房间、天气与异类修正组合。人类秩序场应低频或脏区更新，不做每 Tick 全图扩散。

## 夜间可达性

路径系统读取基础 WalkCost 与角色认知风险。镇民可因恐惧、镇规或未知区域拒绝路线；紧急命令可以覆盖，但生成思想与风险。

## 关键玩法

- 灯熄灭不立即刷怪，而是改变可达性、心理安全、异常触发与社会归属。
- “禁灯区”可主动维持黑暗以满足某些契约，形成物流和安全冲突。
- 新建灯点可能被某异类视为侵占土地，触发债务。

## 测试

局部拆墙、开关门、灯燃尽、暴雨、角色跨边界、连续百万次脏区更新；验证队列不增长、Room 一致、路径版本正确。

## WM-0019 implementation note

M1 map authority now starts in `packages/sim-core/src/map-grid.ts`. The grid
stores terrain, occupancy, walk cost, region id, room id, per-cell version,
chunk version and chunk dirty metadata in typed numeric lanes. Dirty chunks are
queued once, drained by an explicit per-tick budget, and represented in stable
snapshot/hash order for future save and replay hooks. Region graph rebuild,
room consistency rebuild, pathfinding, reservations and renderer projections
remain out of scope for WM-0019.
