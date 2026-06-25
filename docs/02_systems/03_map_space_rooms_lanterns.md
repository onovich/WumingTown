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

## WM-0020 implementation note

`LocationStore` is the owner for entity map/container membership. `MapGrid`
occupancy remains a derived numeric lane: map placement sets the entity index
plus one, map movement clears the previous occupied cell, and container
transfer/despawn/destroy cleanup clears occupancy through explicit lifecycle
paths. `SpatialIndex` maintains deterministic per-cell, per-chunk, and
per-region buckets so pawn/work queries can use indexed candidates rather than
scanning all entities or the full map.

## WM-0021 implementation note

`MapGrid` now records cardinal wall and closed-door masks as integer topology
lanes. `RegionRoomRebuilder` owns derived region and room ids through an
explicit dirty-cell queue and a budgeted flood-fill state machine. Terrain,
wall and door edits enqueue only the changed cell and cardinal neighbors; load
or debug rebuild may enqueue all cells, but normal rebuilds drain by caller
budget and report remaining dirty cells, active backlog, processed cells,
processed regions and map update counts.

Navigation, region, room and region-graph versions advance monotonically when
topology is invalidated. Future pathing must carry these versions as stale
rejection basis data and must not assume a queued rebuild has already drained.

## WM-0022 implementation note

Path requests now use that monotonic version basis directly. A queued request
captures `MapGrid.globalVersion` plus the current navigation, region, room and
region-graph versions; the commit step compares the full basis against the
current map/rebuild state and rejects incompatible results before movement or
job state can consume them.

The first local pathfinder reads only `MapGrid` public passability and cardinal
neighbor APIs, so wall, door and terrain edits remain owned by the map and
region-room rebuild systems. Later region-graph pathing can replace or precede
the local A star without changing the stale-result contract.

## WM-0035 implementation note

M2 work selection now resolves pathing only for caller-supplied WorkOffer
candidates that already came from the indexed bucket query. Candidate rows are
checked against current target cell passability and region id before exact
pathing; stale region rows reject as `work_path_region_unreachable` without
running A\*. Exact path requests still carry map, navigation, region, room and
region-graph versions, and the selection result rejects stale path bases before
returning a selectable work path.

## WM-0027 implementation note

The M1 road-lantern-frame completion path creates one entity and places it at
the build anchor through `LocationStore.placeOnMap`, which commits occupancy
into `MapGrid`. The completed fixture records `unlit_pending_fuel` lantern
state for later systems, but WM-0027 does not run light diffusion, human-claim
spread, night-risk updates or social consequences.

## WM-0062 implementation note

M4 lamp rule authority starts in `packages/sim-core/src/m4-lamp-network.ts`.
`M4LampNetworkStore` owns linked lamp groups and integer maintenance, fuel,
wick, damage, `humanClaim`, and `shadowGap` lanes. Lamp registration can derive
room and chunk keys from `MapGrid.readCellByIndex`, but normal lamp mutation
does not scan map cells.

Lamp mutations enqueue exact lamp, group, cell, room, chunk, and projection
keys in a bounded deterministic dirty queue. Visual light is exposed only by a
read-only projection with owner-version basis validation; projection consumers
cannot mutate lamp rule fields and stale projection bases are rejected.

`M4LampGapIndex` is the first indexed risk-read surface for active lamp gaps.
It keeps sorted global, group, room, and group-room candidate buckets, so normal
actor/anomaly-style reads apply candidate and selected Top-K caps inside the
requested scope instead of filtering a global capped list. If its derived dirty
queue overflows, the index refuses reads until a load/debug rebuild refreshes
from owner state; it must not publish a stale source version as current.
