# 角色 AI、Job、Reservation 与寻路

## 分层

```text
硬约束 → 玩家政策 → 生理紧迫度 → WorkOffer 候选
→ 廉价过滤 → Top-K 距离/效用 → 精确路径 → 原子预订
→ Job Driver 状态机
```

## WorkOffer

工作产生方在状态变化时注册/更新机会，而不是每个 Pawn 扫描世界：

```text
待搬物、缺料蓝图、可用订单、病人、熄灭灯点、未整理证据、待核验旅客
```

索引按工作类型、区域、Def、紧急度和权限组织。角色只查询自己可做的桶。

## Job

Job 保存意图和目标；Driver 保存步骤。示例“补充灯油”：

```text
Reserve(lamp, oil stack, interaction cell)
→ PathTo(oil)
→ Take(amount)
→ PathTo(lamp)
→ Refill
→ Release
```

每步定义进入、Tick、完成、失败、取消与保存字段。禁止以 Promise/Generator 隐式保存位置。

## 中断

中断来源：目标失效、路径失效、紧急生理需求、玩家命令、危险升级、能力变化。中断策略分 `Never / AtSafePoint / Immediate / EmergencyOnly`。所有中断统一清理 Reservation 和携带状态。

## Reservation

支持实体、格子、数量、交互位和容量。多目标通过事务一次获取。记录 Owner、JobId、Channel、Amount、CreatedTick、LeaseExpiry。租约只作异常恢复，正常流程必须显式释放。

WM-0023 通过 `ReservationLedger` 实现首个权威账本：

- 事务先校验所有 claim，再一次性提交；失败不会留下部分预订。
- 支持 `entity`、`cell`、`item_quantity`、`interaction_spot`、`capacity` 五类 channel。
- `item_quantity` 和 `capacity` 使用整数 Amount 与调用方提供的当前上限核算；后续 Item/Storage owner store 负责提交真实数量变化。
- `LocationStore` 的生命周期 hook 会在 despawn/destroy 时调用账本清理相关 owner/target 预订。
- `LeaseExpiry` 仅进入记录和快照，用于恢复诊断；正常 Job 完成、取消和中断必须显式 release。
- 失败原因区分 stale entity handle、实体/格子/交互位冲突、数量不足、容量不足和无效参数。

## 寻路

粗 Region 路径 + 局部 A\*。请求携带地图导航版本；异步结果返回后版本不符即丢弃。只对 Top-K 候选做精确路径。常用目标可缓存 Region 距离，不缓存角色完整路径过久。

## 可解释性

工作失败分层记录：权限、技能、材料、预订、区域、风险、路径、时间表、镇规、目标状态。UI 可展示最有行动价值的前 3–5 个原因。

## 性能底线

任何新增 WorkGiver/WorkOffer 查询必须在文档标明候选上限和复杂度。禁止 `Pawn × WorkType × AllEntities`。

## WM-0022 implementation note

`packages/sim-core/src/pathing.ts` introduces the first M1 path request
surface. `PathVersionBasis` records map, navigation, region, room and
region-graph versions; every request and result carries that basis, and
`PathRequestBatcher.commitResult` rejects stale results before callers can
mutate authoritative state.

`GridPathfinder` runs bounded local A star over `MapGrid` public APIs with
caller-owned request limits and reusable typed scratch lanes. It returns
structured reasons such as invalid cells, blocked starts/goals, no route and
node-budget exhaustion instead of ambiguous failure strings.

`resolveTopKPathCandidates` performs bounded deterministic Top-K selection over
already indexed caller-supplied candidates, then runs exact local pathing only
for those selected entries. The pathing layer does not scan world entities, does
not discover work, and does not store actor-owned long-lived complete paths.
