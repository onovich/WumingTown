# 存档、重放与迁移

## 容器

```text
Header：Magic、格式版本、构建、时间、校验
ContentManifest：模组、版本、Hash、Def 字典
World：全局与派系汇总
MapChunks：原始网格和地图实体
EntityStores：组件数组和稀疏 Arena
JobsReservations
ChronicleObligationsStory
RandomStreams
CommandLogTail
```

数字 Store 使用固定布局二进制块；稀疏元数据可用规范化 JSON。压缩在 Chunk 层可选，Codec 必须隔离并可迁移。

## JobsReservations / ReservationLedger v1

WM-0023 增加 `ReservationLedger` 快照面，作为未来 `JobsReservations`
section 的 reservation 子结构。当前不实现完整 save container，只要求账本
自身可以 round-trip：

- `snapshotVersion = 1`
- `capacity`、`entityCapacity`、`cellCount`、interaction/capacity slot limit
- `ledgerVersion`、`activeCount`
- 按 claim id 稳定排序的 records
- 每条 record 包含 owner entity、job id、channel、amount、created tick、
  lease expiry tick，以及 channel 所需的 target entity、cell index 或 slot

加载时先验证版本、id 范围、整数 tick/amount、owner/target entity shape，并在
提供 `EntityRegistry` 时校验 generation。重建时只恢复 owner state 和索引；
派生可用量、WorkOffer、路径缓存和 UI read model 不进入该快照。

## 写入

桌面：临时文件 → Flush → 校验 → 原子替换 → 保留上一版本。Web：A/B Slot → 校验 → Manifest 指针切换。Web 必须提供导入导出。

## 加载

校验 → 创建实体 → 读原始状态 → 解析引用 → 迁移 → 重建索引/房间/缓存 → 验证不变量 → 开始 Tick。

## 重放

记录种子、内容 Hash、玩家命令与周期 World Hash。Bug 报告可附命令流和最小存档。目标是同构建可复现，不承诺跨重大版本逐 Tick 完全一致。

## 迁移

每个 Chunk 有 SchemaVersion。迁移函数只从 N 到 N+1，纯函数、带测试。禁止在普通加载代码中散布旧版本 `if`。

## M2 architecture gate note

`coordination/decisions/ADR-0007.md` is the M2 work/logistics architecture gate
for save/replay scope.

- M2 save/replay work is a focused scenario harness for
  `m2.work_logistics.lantern_yard.v1`; it does not create a public save
  compatibility promise or broad Save Container change.
- Authoritative save/replay input is owner-store snapshots, deterministic
  random stream state and command log tail produced by Simulation Worker or
  Node headless. Platform storage owns only opaque bytes or test artifacts.
- Derived WorkOffer rows, storage availability, path caches, read models,
  UI projections and benchmark summaries do not enter authoritative save
  payloads. Load rebuilds them from owner stores before the first resumed tick.
- Any need to add or change a public save section, public schema version,
  cross-version migration behavior, codec dependency or platform save API
  blocks the implementation task until a separate architecture gate is
  reviewed.
- The M2 resume gate must prove save at tick 6000, load at tick 6001 in the
  resume run, equal hashes to uninterrupted replay, rebuilt derived indexes and
  structured divergence diagnostics.

## JobsReservations / JobCore v1

WM-0025 adds `JobCoreStore` snapshot fields for the future `JobsReservations`
section. The current task does not implement the full save container; it
requires the job core subsection to round-trip and hash deterministically:

- `snapshotVersion = 1`
- `capacity`, `storeVersion`, `activeCount`
- stable ascending `records` by `jobId`
- owner entity handle, job kind, target id, status, driver step, interruption
  policy, failure reason, created tick, step-entered tick, step tick count,
  Q16 progress, required Q16 work and carried def/amount lanes

Restore validates version, shape, sorted job ids, owner handles and integer
lanes through a scratch store before mutating the target store. Derived
WorkOffer indexes, path requests and UI read models still rebuild from owner
state rather than entering the authoritative snapshot.

## WM-0037 reservation rebuild note

WM-0037 does not change the public save container, snapshot version or migration
contract. `ReservationLedger.restoreFromSnapshot` now rejects record-count,
active-count and ledger-version shape mismatches before clearing the current
ledger, then applies validated records through a scratch ledger.

Focused tests cover two load paths: restoring an empty authoritative
reservation snapshot clears active indexes without stale amount projections, and
restoring a non-empty snapshot rebuilds item/capacity amount indexes from owner
records. Lease expiry is still restored only as diagnostic metadata and is not
used to drive normal job cleanup.

## WM-0028 implementation note

`packages/sim-core/src/m1-save-replay.ts` implements the focused M1
hauling-building save/replay harness. It is not the full Save Container v1 and
does not create a cross-version compatibility promise. The envelope validates
magic, format version, scenario id, section versions, tick ranges and projection
hashes before load succeeds.

The minimal sections mirror the ADR-0005 names needed by this scenario:
`MapChunks`, `EntityStores`, `JobsReservations`, `RandomStreams` and
`CommandLogTail`. Load returns rebuilt derived indexes for work offers,
reservations and read models before resume. Read-only render/UI projections are
copied hash payloads and are not owner stores or mutation APIs.
