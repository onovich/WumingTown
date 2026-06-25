# 经济、物流与生产

## 资源层

基础资源：食物、木材、石料、金属、布、药材、纸、灯油、灯芯。制度资源：劳动力、信任、知识能力、派系信誉、债务容量；后者不能全部转化为通用点数。

## 存储

存储区域拥有过滤器、优先级、容量、环境条件和访问政策。物品改变位置、数量或状态时更新反向索引。

## 生产订单

订单声明：配方、目标数量/库存阈值、允许材料、工人、技能、工作时段、产物目的地。订单不直接操纵 Pawn。

支持半成品与工作进度，避免中断后材料消失。仪式和调查也复用订单框架，但有参与者、时间窗、空间条件和知识前置。

## 搬运

供需匹配分开：需求槽注册所需 Def/数量/截止；供给索引提供可达物品；搬运 Job 原子预订数量和目的地。允许合并相邻任务，但先保证正确性。

## 夜间物流

夜间路径会受灯网、镇规、角色恐惧和异类规则影响。玩家可以设置“黄昏前补满所有灯”“危险区禁止夜运”等策略。

## 经济平衡

- 灯油必须成为早期稳定压力，但不能每晚占用大多数劳动力。
- 纸张与档案保存形成中期竞争：镇志、贸易凭证、教育和契约都需要。
- 异类资源提供高效但伴随义务的替代，不应纯粹优于普通生产。

## 解释

订单面板必须回答：缺什么、最近可用供给在哪、为何不可达、被谁预订、哪个政策阻止、预计何时完成。

## M2 architecture gate note

`coordination/decisions/ADR-0007.md` is the M2 work/logistics architecture gate
for this surface.

- `ItemStackStore` owns source/depot stack definition, integer quantity and
  stack capacity. `JobCoreStore` owns carried quantity after pickup.
  `BuildSiteStore` owns delivered build-site buffers and consumed completion
  audit lanes.
- Storage owner state owns slot membership, accepted defs, capacity, demand
  targets, terminal remainders, priority and access policy. `StorageLogisticsIndex`
  is derived and rebuildable from storage, item and reservation owner versions.
- `BuildOrderStore` owns order activation, required sites, allowed materials,
  demand targets and terminal order state. `BuildSiteStore` owns sockets,
  material buffers, build progress and site terminal state. WorkOffer rows and
  UI order panels are derived.
- M2 storage/build implementation must preserve integer material conservation
  across source stacks, depot stacks, carried lanes, site buffers and consumed
  completion audit. Cancellation or invalidation resolves through owner-store
  transactions exactly once.
- Broad economy, content catalog expansion, public schema changes, public save
  compatibility, new runtime dependencies and UI-owned logistics remain outside
  this gate.

## WM-0026 implementation note

`packages/sim-core/src/item-stack-store.ts` adds the first minimal
`ItemStackStore`. It is the only owner of item definition, integer quantity and
stack capacity for M1 hauling; storage indexes and reservations read derived
availability but do not duplicate or own quantity.

`packages/sim-core/src/storage-logistics-index.ts` adds a state-change-driven
dirty queue for storage supply and demand. Stack quantity changes, storage slot
changes and reservation changes mark exact slots dirty; `refreshDirty` updates
available supply, available capacity, demand amount and WorkOffer supply rows
without pawn-side world scans.

`packages/sim-core/src/hauling-jobs.ts` adds the minimal hauling path for
source-to-storage delivery. A hauling job reserves source quantity, destination
capacity and source/destination interaction spots before pickup. Pickup moves
integer quantity from `ItemStackStore` into explicit JobCore carried lanes, and
delivery or cancellation returns the carried quantity through owner-store
transactions before releasing reservations.

## WM-0038 implementation note

WM-0038 generalizes the M1 storage and hauling fixture without adding broad
economy, crafting or production catalogs. Multiple source stacks, depot stacks
and demand slots remain ordinary owner-state lanes: `ItemStackStore` owns stack
def, quantity and capacity; `ReservationLedger` owns active source quantity and
destination capacity claims; `StorageLogisticsIndex` owns only derived
availability and candidate membership.

Storage dirty work is exact-slot based. Owner mutations call
`markStackDirty` or `markSlotDirty`, then `refreshDirty` drains the bounded
queue and updates per-def supply and demand candidate lanes. A delivered depot
stack may become supply while it still has remaining demand; that is derived
from its owner quantity and desired quantity, not a second quantity owner.

Hauling terminal paths conserve material across source stack, destination
stack and carried lanes. Delivery adds carried material to the destination once
and then completes the job. Cancellation, failure and interruption after pickup
return carried material to the source once before terminal cleanup, with a
rollback if JobCore rejects the terminal transition. Repeated terminal cleanup
is rejected instead of silently returning items again.

## WM-0027 implementation note

`packages/sim-core/src/build-site.ts` adds the minimal M1 build-site material
buffer. The buffer owns delivered site inventory and is not registered as general
storage supply. Build-site material demand and build work are exposed through
`WorkOfferIndex` only while the site still needs material or is ready for
construction.

Build-site delivery reserves source item quantity, site material capacity and
source/destination interaction spots before pickup. Pickup removes quantity from
`ItemStackStore` and records carried state in `JobCoreStore`; delivery converts
that carried quantity into the build-site buffer exactly once and releases
claims through terminal JobCore completion.
