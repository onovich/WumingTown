# 性能预算与优化顺序

## 真实玩法目标

- 128–192 地图、8–24 活动居民、约 20,000 运行实体。
- 30 TPS 正常，90 TPS 三倍；6× 可动态降低表现快照频率。

## 压力目标

- 256×256 地图、100 活动 Pawn、50,000 实体、100+ 并发路径请求。

## 门禁

| 指标          | Windows Electron |     Chromium Web |
| ------------- | ---------------: | ---------------: |
| 正常 Tick P95 |           ≤ 8 ms |          ≤ 12 ms |
| 3× 平均 Tick  |          ≤ 11 ms | ≤ 14 ms 或降上限 |
| 主线程帧 P95  |          ≤ 12 ms |          ≤ 12 ms |
| 队列          |       不持续增长 |       不持续增长 |
| 长时内存      |       无持续增长 |       无持续增长 |

## 热路径政策

目标不是字面 0 B 的整个 JS 进程，而是：权威系统不做与实体数成比例的短命对象分配；正常 Tick 无周期性大 GC；所有高频 Scratch Buffer 复用。

## 优化顺序

1. 删除全局扫描和错误复杂度。
2. 索引、脏区、分频、Top-K、缓存所有权。
3. TypedArray、循环与内存复用。
4. 批量 Worker Kernel。
5. 单个 Rust/Wasm Kernel。
6. 只有架构证据充分才考虑更大重写。

## 必备基准

空世界、100 Pawn 思考、10k 物品物流、100 路径、拆墙房间重建、大战、灯网批量熄灭、证据案卷、长时间无人干预。

性能回退阈值：关键基准 P95 退化 >10% 必须解释，>20% 默认阻止合并。

当前仓库将基准基线固定在 `packages/benchmarks/baseline.json`。`pnpm bench` 必须在相同脚本入口下同时输出机器可比较 artifact，并把当前采样中位数与该显式基线比较；超过 10% 记为警告，超过 20% 视为默认阻止合并的回退。

## WM-0019 benchmark note

`pnpm bench --filter map-dirty` measures the M1 authoritative map dirty path on
a 256x256 grid with 32x32 chunks. The benchmark records changed cells, peak
dirty queue length, rebuild budget, processed chunk count, remaining backlog,
processed checksum and canonical map hash. The normal dirty-drain path uses a
caller-owned typed output buffer so unchanged worlds do not allocate or grow
queues.

## WM-0021 benchmark note

`pnpm bench --filter region-room` measures dirty terrain, wall and door
invalidation through the region/room rebuild queue. The report records changed
edges, peak dirty queue length, rebuild budget, drain ticks, processed cells,
processed regions, map updates, remaining dirty cells, active backlog,
no-sustained-growth evidence, monotonic navigation/region/room/graph versions,
processed checksum and canonical region-room hash.

## WM-0022 benchmark note

`pnpm bench --filter pathing-100` measures 100 deterministic path requests on a
32x32 map with local barriers, then processes one stale result after a version
bump. The report records request count, accepted results, stale rejects, node
expansions, peak/final queue backlog, reached paths and a stable path checksum.
The benchmark artifact is written under
`coordination/artifacts/WM-0022/benchmarks/benchmark-results.json`.

## WM-0023 benchmark note

`pnpm bench --filter reservations` measures the authoritative reservation ledger
under deterministic item-quantity and capacity contention. The report records
transaction attempts, accepted and rejected transactions, conflict count,
cleanup releases, final active claims, per-channel active counts and stable
transaction/cleanup checksums. The benchmark artifact is written under
`coordination/artifacts/WM-0023/benchmarks/benchmark-results.json`.

## WM-0026 benchmark note

`pnpm bench --filter logistics-10k` measures 10,000 source storage supply slots,
100 destination slots and 100 hauling reserve/pickup/deliver cycles through the
minimal item/storage/hauling core. The benchmark reports bounded WorkOffer
candidate visits, candidate-cap hits, delivered job count, final active
reservation claims, item quantity conservation, storage dirty backlog and
stable selection/quantity checksums.

The benchmark artifact is written under
`coordination/artifacts/WM-0026/benchmarks/benchmark-results.json`.
