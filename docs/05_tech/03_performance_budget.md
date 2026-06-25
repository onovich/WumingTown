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

## M2 work/logistics gate metrics

`coordination/decisions/ADR-0007.md` extends the performance gate for the M2
work/logistics vertical slice without changing baseline thresholds.

M2 implementation and benchmark tasks must report:

- visited WorkOffer rows, scored rows, selected rows and candidate-cap hits;
- exact-path Top-K candidates, A\* node visits, accepted results and stale
  version-basis rejects;
- reservation transaction attempts, accepted/rejected claims, conflict classes,
  cleanup releases and final active claim count;
- dirty storage slots, WorkOffer dirty backlog, path queue backlog, read-model
  queue depth and steady-state idle evidence;
- material conservation counters across source, depot, carried, build buffer
  and consumed completion audit lanes;
- save/load rebuild time, rebuilt index counts, first resumed hash and
  uninterrupted/resume/Worker hash checkpoints;
- render/read-model snapshot bytes and Worker parity overhead when WM-0041 adds
  focused parity evidence.

Normal M2 ticks must still avoid global scans, unbounded sorts and per-entity
allocation in actor thinking, work selection, reservation, pathing, cleanup and
read-model production. Load-time rebuild scans are allowed only before resumed
ticks and must be measured.

## WM-0035 benchmark note

`packages/benchmarks/src/m2-path-work-selection-benchmark.ts` measures the M2
Region/A* work-selection bind without changing the existing benchmark baseline
file. The benchmark registers indexed WorkOffer rows, performs 100 bounded
selection attempts with `candidateCap = 24`, `selectedCap = 12` and
`exactPathCap = 4`, and records visited/scored/selected candidates, cap hits,
exact path requests, accepted path results, stale basis rejects, queue backlog,
A* node expansions and a deterministic checksum.

The existing benchmark CLI registry does not yet include a
`m2-path-work-selection` filter, and that registry is outside WM-0035's allowed
edit paths. WM-0035 therefore writes the focused artifact through the exported
benchmark helper under
`coordination/artifacts/WM-0035/benchmarks/m2-path-work-selection-results.json`
while preserving the existing `pathing-100` baseline gate.

## WM-0036 benchmark note

`packages/benchmarks/src/m2-work-offer-20-pawns-benchmark.ts` measures focused
multi-pawn WorkOffer scoring without changing the existing benchmark baseline
file. The benchmark registers `600` fixture offers across `20` actor buckets,
then runs one bounded indexed selection pass with `candidateCap = 24`,
`selectedCap = 12` and `ReasonTraceStore` capacity `64`.

The benchmark records bucket candidate totals, visited rows, scored rows,
selected rows, candidate-cap hits, selected-cap hits, rejection counts,
trace storage, equivalent-score stability and a deterministic checksum. The
expected bounded evidence is `480` visited/scored rows instead of the
`12,000` actor-by-all-offers scan equivalent.

The existing benchmark CLI registry does not yet include a
`m2-work-offer-20-pawns` filter, and that registry is outside WM-0036's allowed
edit paths. WM-0036 therefore writes the focused artifact through the exported
benchmark helper under
`coordination/artifacts/WM-0036/benchmarks/m2-work-offer-20-pawns-results.json`
while preserving the existing `work-offers` baseline gate.

## WM-0037 benchmark note

`packages/benchmarks/src/m2-reservation-contention-benchmark.ts` measures
deterministic M2 reservation contention without changing the existing benchmark
baseline file. The benchmark runs 64 contention groups over 20 owners and 64
target sets, with each accepted base transaction claiming entity, cell,
item-quantity, interaction-spot and capacity channels atomically.

The benchmark records transaction attempts, accepted and rejected counts,
per-channel conflict classes, stale target rejects, invalid owner rejects,
insufficient amount/capacity rejects, invalid parameter rejects, terminal
cleanup releases, destroy cleanup releases, load-rebuild clearing, final active
claims and stable transaction/cleanup checksums. The current expected focused
evidence is zero final and unexpected active claims with transaction checksum
`2383137698` and cleanup checksum `90211268`.

The existing benchmark CLI registry does not yet include a
`m2-reservation-contention` filter, and that registry is outside WM-0037's
allowed edit paths. WM-0037 therefore runs the exported benchmark helper
directly while preserving the existing `reservations` baseline gate. No
`coordination/artifacts/WM-0037/**` artifact is kept by this task.

## WM-0038 benchmark note

`packages/benchmarks/src/m2-logistics-hauling-benchmark.ts` measures focused
M2 storage and hauling behavior without changing the existing benchmark
baseline file. The benchmark creates 12 source slots, 8 destination/demand
slots and 20 pawn-owned hauling jobs over wood and stone. It selects source and
demand slots through the derived per-def storage candidate lanes with
`candidateCap = 6`, then exercises delivery, cancellation, failure and
interruption terminal paths.

The benchmark records selected supply and demand candidates, candidate-cap
hits, delivered/canceled/failed/interrupted job counts, final active
reservations, dirty backlog peak/final backlog, indexed supply/demand counts,
wood and stone conservation, selection checksum and quantity checksum. The
current focused evidence is 5 jobs in each terminal class, zero final active
claims, final dirty backlog 0, wood `48 -> 48`, stone `48 -> 48`, selection
checksum `4104632364` and quantity checksum `3068116868`.

The existing benchmark CLI registry does not yet include a
`m2-logistics-hauling` filter, and that registry is outside WM-0038's allowed
edit paths. WM-0038 therefore runs the exported benchmark helper directly while
preserving the existing `logistics-10k` baseline gate.

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

## WM-0029 benchmark note

`pnpm bench` now includes the focused `m1-hauling-building-long-run` benchmark
alongside the existing map dirty rebuild, spatial index, 100-path, reservation,
work-offer and 10k logistics checks. The M1 benchmark runs the
`m1.hauling_building.road_lantern_frame.v1` scenario to 100000 ticks with seed
`1`, verifies replay and save-resume hashes, and records reservation, stale
reference, negative resource, queue growth, hash divergence and material
conservation invariants. Queue-growth and stale-reference invariants are
derived from repeated idle-window samples from tick `2401` through `100000`, not
only from a single terminal-state read.

The WM-0029 benchmark artifact is written under
`coordination/artifacts/WM-0029/benchmarks/benchmark-results.json`. The
artifact-backed baseline update preserves the existing 10 percent warning and
20 percent blocking thresholds. `map-dirty` also receives an explicit canonical
hash refresh to `0xba7253ca`; its timing budget and regression thresholds are
unchanged.

## WM-0042 benchmark note

`pnpm bench` now includes two M2 closeout benchmarks alongside the existing
suite:

- `m2-work-logistics-long-run` runs
  `m2.work_logistics.lantern_yard.v1` with seed `2` to `100000` ticks, samples
  terminal states from tick `20000` through `100000`, and verifies save/resume
  replay parity. The invariant baseline records 20 actors, 4 completed build
  orders, 24 delivered wood, 12 delivered stone, final world hash
  `0xc0e8df05`, final read-model hash `0xb9a8a2d6`, zero terminal
  reservations/offers/running jobs, material conservation and no hash
  divergence.
- `m2-pathing-invalidation` runs 100 deterministic path requests on the
  M2-sized 40x24 invalidation fixture, then commits one stale result against a
  changed version basis. The invariant baseline records 101 processed results,
  100 accepted results, 1 stale reject, 85 reached paths, 26718 node
  expansions, peak queue backlog 100, final backlog 0 and checksum
  `3453753114`.

The WM-0042 benchmark artifact is written under
`coordination/artifacts/WM-0042/benchmarks/benchmark-results.json` with SHA-256
`1B879392B0ED44AE1C3A4368DF533A133E140716B40AD9B0DBE2D3A4CD02487C`. The
artifact includes Node, pnpm, OS, platform, architecture, CPU, Git commit,
scenario id, seed, tick horizon and final hashes. The baseline update preserves
the existing 10 percent warning and 20 percent blocking thresholds for every
entry.
