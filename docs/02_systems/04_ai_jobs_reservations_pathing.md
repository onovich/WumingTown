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

## M2 architecture gate note

`coordination/decisions/ADR-0007.md` is the M2 work/logistics architecture gate
for this surface.

- WorkOffer rows remain derived from owner stores. Storage owners, build/order
  owners, `JobCoreStore`, `ReservationLedger`, actor permission lanes and
  map/region versions own the facts behind a row.
- A WorkOffer row must carry its owner target id and owner-store version. A
  stale row is rejected or refreshed before reservation; it cannot create jobs,
  move quantities, release claims or complete builds.
- `ReservationLedger` remains the sole owner of active claims. Availability
  counters and UI explanations are projections only.
- Path requests/results carry map, navigation, region, room and region-graph
  version basis. Stale results are rejected before job, reservation, actor,
  item or build-site mutation.
- Any M2 implementation that needs global work scans, unversioned path/work
  caches, UI-owned correction, public Worker protocol drift or save/schema
  drift must block and request a separate gate before coding.

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

## WM-0024 implementation note

`packages/sim-core/src/work-offers.ts` adds the first derived WorkOffer index.
Work producers register, update or remove offers when owner state changes; the
index does not own job, item, reservation or location facts. Offers are keyed by
work type, region, def, urgency bucket and permission id in exact composite
buckets, with stored bucket counts so pawn thinking can report candidate totals
without traversing every offer.

Candidate lookup and scoring use explicit caps. `selectTopOffers` visits at
most `candidateCap` offers from one indexed bucket, selects at most
`maxSelectedOffers`, orders by score descending and stable offer id, and records
bounded ReasonTrace data. The documented M1 cap remains 8 scored offers per
pawn before exact pathing.

## WM-0035 implementation note

`selectPathResolvedWorkOffer` binds the indexed WorkOffer selection path to
versioned local pathing for M2. The caller supplies the indexed query and typed
scratch buffers; the helper never discovers work by scanning map cells or
entities. The provisional M2 caps are explicit in the call: visit up to the
query `candidateCap`, score up to `maxSelectedOffers`, and exact-path no more
than `maxExactPaths` Top-K candidates.

The returned reason and counters distinguish indexed no-candidate,
region-unreachable, stale path basis, invalid candidate, blocked target,
no-route, node-budget and exact Top-K-cap outcomes. The helper returns only a
selected path result and metrics; it does not create jobs, mutate reservations,
move items, or persist actor-owned full paths.

## WM-0036 implementation note

`WorkOfferIndex.selectTopOffersForPawns` scales the indexed WorkOffer scoring
path to multiple actors without changing ownership. Callers provide typed query
lanes for pawn id, work type, region, def, urgency and permission; the index
still reads only the exact composite bucket for each pawn. It does not scan all
entities, all map cells or all WorkOffer rows.

The provisional M2 caps are explicit in the call: `candidateCap = 24` visited
and scored rows per pawn, `maxSelectedOffers = 12` retained offers per pawn,
and `ReasonTraceStore` capacity `64` for the focused scenario evidence. The
multi-pawn helper uses caller-owned candidate, selected and output buffers.
Selection remains score-descending with offer id as the stable equivalent-score
tie-break.

The selector reports per-pawn and aggregate candidate totals, visited rows,
scored rows, selected rows, candidate-cap rejections and selected-cap
rejections. Those counters are diagnostic evidence only; WorkOffer rows remain
derived from owner stores and cannot create jobs, reserve claims, move items or
complete targets.

## WM-0037 implementation note

`ReservationLedger` remains the sole owner of active entity, cell,
item-quantity, interaction-spot and capacity claims. M2 contention tests now
cover all five channels in one transaction and assert failed acquisition leaves
all active counts and amount indexes unchanged.

Structured reservation reasons distinguish true contention from owner/target
staleness, invalid parameters and shortage:
`reservation_item_quantity_conflict` and `reservation_capacity_conflict` mean an
existing active claim blocks the request, while `reservation_insufficient_amount`
and `reservation_insufficient_capacity` mean the owner-store supplied limit
cannot satisfy the requested amount even without another claim.

Job completion, failure and cancellation continue to release owner/job claims
through `JobCoreStore` cleanup. Destroy/despawn cleanup uses the location
lifecycle hook to release claims by target or owner entity. Lease expiry remains
metadata for diagnostics and recovery; normal job progression must still call
explicit release or terminal cleanup paths.

## WM-0025 implementation note

`packages/sim-core/src/job-core.ts` adds `JobCoreStore`, the first explicit
serializable Job Driver state surface. Jobs store owner handle, kind, target,
status, current driver step, interruption policy, step-entered tick, per-step
tick count, integer Q16 progress, required work, carried state and structured
failure reason in numeric lanes.

Driver movement is exposed through `createJob`, `enterStep`, `tickJob`,
`completeJob`, `failJob`, `cancelJob` and `requestInterruption`. No Promise,
Generator, coroutine, closure or UI execution position is stored. Terminal
paths share cleanup that releases `ReservationLedger` owner/job claims and
clears carried state.

## WM-0026 implementation note

`packages/sim-core/src/hauling-jobs.ts` layers a hauling-specific explicit state
machine on top of `JobCoreStore`: `created -> reserved -> picked_up ->
delivered/canceled`. The hauling lanes store source slot, destination slot,
amount and carried item facts as serializable integers; no Promise, Generator,
coroutine or closure stores execution position.

The reservation step acquires all claims atomically through `ReservationLedger`:
source `item_quantity`, destination `capacity`, source `interaction_spot` and
destination `interaction_spot`. If any claim fails, no item quantity moves and
no partial reservation remains. Cancellation after pickup returns carried
quantity to the source stack before JobCore cancellation releases owner/job
claims.

## WM-0027 implementation note

`packages/sim-core/src/build-site.ts` adds explicit delivery and construction
state machines for M1 build sites. Delivery jobs use
`created -> reserved -> picked_up -> delivered`; construction jobs use
`created -> building -> built`. Job position is stored in typed lanes plus
`JobCoreStore`; no Promise, Generator, coroutine or closure stores progress.

Build-site delivery reserves source item quantity, site material capacity and
source/destination interaction spots before pickup. Construction reserves the
site entity and one interaction spot before ticking integer build progress.
Structured reasons distinguish `material.insufficient_required_amount`,
`material.def_not_required`, `reservation.destination_capacity_conflict`,
`path.no_route_to_destination`, `site.blocked` and `target.invalid_state`.
