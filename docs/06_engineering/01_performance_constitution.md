# 性能宪法

1. 角色思考不得扫描全地图。
2. 新 O(N) 查询必须记录 N 的上限、频率和索引替代方案。
3. 每个系统必须暴露耗时、调用数、处理实体数和积压。
4. 热路径不得产生与实体数成比例的临时对象。
5. 大型重算必须局部失效或按预算分帧。
6. 异步结果必须带输入版本；过期结果丢弃。
7. 快进不得通过跳过规则伪造性能。
8. 优化前先有基准；优化后保留回归测试。
9. 不允许“性能以后再说”的中央扫描或无界队列进入主分支。
10. 不因微优化破坏可读性，除非热点报告证明收益。
11. Wasm 边界只传连续数值数据，不传复杂对象。
12. Web 与 Electron 都要测；Electron 快不代表 Web 合格。

## WM-0020 spatial index budget note

Spatial lookup for map entities must go through `SpatialIndex` cell, chunk, or
region buckets. Normal pawn/work candidate lookup must not call an all-entity
scan to answer proximity or region membership questions. The WM-0020 benchmark
tracks 50k indexed inert entities, query count, moved entities, cleanup count,
indexed membership, backlog count, stable checksums, elapsed time, and heap
delta; backlog must remain zero because the index is updated synchronously from
owner-store mutations.
