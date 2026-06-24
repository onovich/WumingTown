# 实体、Def 与组件存储

## Def

Def 只保存静态内容，使用命名空间字符串 ID，例如：

```text
core.item.lamp_oil
core.job.refill_lantern
core.anomaly.borrowed_shadow
mod.example.ordinance.red_cord
```

编译后映射为紧凑 `DefIndex`。存档保存自身 Def 字典，不能只保存运行时下标。

## EntityId

逻辑上由 `index` 与 `generation` 组成。热点内可传 index，但跨 Tick、跨集合和存档引用必须验证 generation。销毁实体后增加 generation，防悬空引用。

## 存储策略

高频同构数据采用 SoA TypedArray：位置、移动、需求、Job 核心字段、状态标记。低频可变数据使用 Arena/Pool：伤病、记忆、关系边、证据、契约条款。

禁止每个格子、物品或 Pawn 创建带方法的复杂对象图。允许系统服务类和少量不可变值对象。

## 结构变更

系统执行中不得直接增删实体或改变组件集合。通过 `WorldCommandBuffer` 记录，在阶段 11 按稳定顺序提交。

## 生命周期

```text
allocate id → attach required stores → initialize → spawn on map
→ active → despawn/transfer → destroy → generation++
```

所有关系、Reservation、容器和索引必须在销毁时收到统一清理通知。

## WM-0020 implementation note

M1 location authority starts in `packages/sim-core/src/location-store.ts`.
`LocationStore` owns each live entity's `none`, map-cell, or container
membership with generation validation and typed numeric lanes. Map occupancy,
cell/chunk/region spatial buckets, and future reservation release hooks are
derived cleanup surfaces updated through explicit move, despawn, and
destroy-cleanup calls; direct registry destruction without the lifecycle hook is
treated as stale-generation input and rejected.

## 不变量

- 活跃实体拥有合法 Def。
- 位置实体只属于一个 Map/Container。
- 容器所有权与空间位置互斥。
- 可持久引用必须验证 generation。
- Store 长度、容量和活跃位图一致。
