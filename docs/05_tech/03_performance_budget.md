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

## M3 ordinary-life gate metrics

`coordination/decisions/ADR-0008.md` extends the performance gate for the M3
ordinary-life scenario without changing baseline thresholds.

M3 implementation and benchmark tasks must report:

- scheduled need update counts, stagger distribution, candidate totals, Top-K
  cap hits, and per-system cost;
- rest fixture, food portion, medical offer, and social event candidate counts,
  visited rows, selected rows, exact path caps, and cap-hit ReasonTrace rows;
- condition update counts, ability cache invalidations, stale cache rejects,
  and ability query cost;
- treatment/eating/rest job counts by state and terminal reason, reservation
  attempts, cleanup releases, and final active claims;
- thought generation and retained counts, relationship event and edge counts,
  day/night and weather update cost, dirty queue peak/final backlog, and
  ReasonTrace capacity use;
- snapshot byte size, load validation time, derived rebuild time, command log
  size, resume hash comparison, Worker parity latency counts, read-model sizes,
  and checkpoint hashes.

Normal M3 ticks must preserve the no-global-scan, no-unbounded-sort, and
allocation-sensitive hot-path policy. Raising ADR-0008 candidate caps or trace
retention requires explicit task evidence and must not weaken the 10 percent
warning or 20 percent blocking regression thresholds.

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
  orders, 20 participating actors, 24 delivered wood, 12 delivered stone,
  final world hash `0x9e689c8d`, final read-model hash `0x2d2933dc`, zero terminal
  reservations/offers/running jobs, material conservation and no hash
  divergence.
- `m2-pathing-invalidation` runs 100 deterministic path requests on the
  M2-sized 40x24 invalidation fixture, then commits 20 delayed results against a
  changed version basis. The invariant baseline records 100 processed requests,
  80 accepted results, 20 stale rejects, 68 reached paths, 25957 node
  expansions, peak queue backlog 100, final backlog 0 and checksum
  `1481150542`.

The WM-0042 benchmark artifact is written under
`coordination/artifacts/WM-0042/benchmarks/benchmark-results.json` with SHA-256
`7AAD7C5CA023F018A2B00F0F205C784EDCF2CACCA139C11C84A519A93891C8AC`. The
artifact includes Node, pnpm, OS, platform, architecture, CPU, Git commit,
scenario id, seed, tick horizon and final hashes. The baseline update preserves
the existing 10 percent warning and 20 percent blocking thresholds for every
entry.

## WM-0048 M3 needs index note

`NeedStore` and `NeedUrgencyIndex` add focused M3 measurement surfaces without
changing benchmark thresholds. Store metrics report owner version, actor count,
scheduled need update count, scheduled change count, and the most recent phase
visit count. Urgency index metrics report source/index versions, indexed lane
count, dirty backlog peak/final backlog, refreshed dirty rows, and rebuild
count.

Normal urgency selection is bounded by caller candidate and selected caps and
reads only the requested lane's urgency buckets. Scheduled need updates keep
per-phase cursors, so budgeted processing resumes within the phase instead of
restarting at the head. Changed owner mutations must dirty exact urgency rows
through `NeedUrgencyIndex.markMutationDirty(result)` or a scheduled
`NeedDirtySink`. Load/replay rebuild may scan registered actors before resumed
ticks. WM-0059 remains responsible for adding suite-level baselines and artifact
reporting for long-run M3 ordinary-life performance.

## WM-0059 benchmark note

`pnpm bench` now includes `m3-ordinary-life-long-run` in the default benchmark
suite. The benchmark runs `m3.ordinary_life.injured_caregiver.v1` with
requested seed `3` and authoritative seed `46` to `100000` ticks, samples
terminal evidence at `12000`, `36000`, `60000`, `80000` and `100000`, and
verifies replay plus save/resume hash parity.

The M3 baseline records need update count `2`, condition update count `1`,
ability cache invalidation count `1`, thought event count `3`, social event
count `4`, total candidate visits `11`, cap hits `0`, exact path requests `1`,
path node count `2`, rebuilt surface count `15`, Worker projection bytes
`1747`, final world hash `0x7eb81a69`, final read-model hash `0x82bf87d6`, and
zero terminal reservations, running jobs, stale medical requests, stale medical
offer basis rejects, negative needs/resources, stale ability cache rejects,
condition drift, mood/relationship drift, M4 facts and conservation drift. The
baseline invariants include exact stable condition, mood and relationship
values so legal-range drift still fails comparison.

The WM-0059 benchmark artifact is written under
`coordination/artifacts/WM-0059/benchmarks/benchmark-results.json`. It includes
Node, pnpm, OS, platform, architecture, CPU, Git commit, scenario id, seed,
tick horizon, checkpoint hashes including tick `100000`, final summary, Worker
snapshot/read-model/projection bytes, save/load rebuild timing and final
hashes. The baseline update preserves the existing 10 percent warning and
20 percent blocking regression thresholds for every entry.

## WM-0062 M4 lamp owner-store metrics

`M4LampNetworkStore.createMetrics()` records lamp owner version, active lamp and
group counts, dirty backlog peak/final counts, drain count, drained key count,
last drain size, normal-tick visited lamp/cell counts, and full-map diffusion
count. Normal lamp dirty work drains caller-bounded exact lamp keys; tests
assert one changed lamp visits one lamp/cell key and leaves full-map diffusion
at zero.

`M4LampGapIndex.createMetrics()` records source/index versions, active gap
count, dirty backlog peak/final counts, rebuild-required state, missed dirty
count, refreshed dirty lamp count, load/debug full rebuild scans, and query
visit totals. Actor/anomaly-style reads use sorted global, group, room, or
group-room active gap candidate buckets with candidate and selected Top-K caps;
load/debug rebuild may scan registered lamp capacity and reports that
separately.

## WM-0063 M4 Chronicle evidence metrics

`M4EvidenceFactStore.createMetrics()` records evidence owner version, source
count, evidence row count, hypothesis count, contradiction count, confirmed-rule
count, last support candidate visits, and total support candidate visits.
Support evaluation walks only the hypothesis indexed evidence lane and respects
caller candidate and selected caps; tests assert a 40-row hypothesis visits 32
candidates with a 32-row cap instead of scanning every row.

`M4KnowledgeDisseminationStore.createMetrics()` records knowledge owner
version, row count, dirty backlog peak/final counts, drain count, and drained
key count. Dissemination changes enqueue exact resident/rule or resident/policy
dirty keys so projection consumers do not need a full resident or rule scan.

## WM-0064 M4 obligation and town-rule metrics

`M4ObligationStore.createMetrics()` records obligation owner version, active
obligation count, due-indexed count, fulfilled count, violated count, last due
candidate visits and total due candidate visits. Normal actor-facing obligation
reads walk only the debtor due lane through `queryDueObligations` with a caller
candidate cap, scan cap and typed output buffer. The candidate cap counts
matching due-window candidates; the scan cap bounds total inspected debtor-lane
rows. If scan cap is exhausted, the read returns
`obligation_due_scan_cap_reached` and metrics report the actual inspected row
count. Fulfillment and violation unlink due rows instead of requiring cleanup
scans.

`M4TownRuleStore.createMetrics()` records town-rule owner version, active rule
count, compliance-indexed count, last compliance candidate visits, total
compliance candidate visits and cumulative enforcement cost. Compliance reads
walk only the subject-scope/region/trigger/action rule bucket with caller
candidate and scan caps. Out-of-time rows are scan-counted but do not consume
candidate cap; if scan cap is exhausted, the read returns
`town_rule_scan_cap_reached`. Relationship, need, fear, enforcement risk,
emergency, confirmed identity and obligation pressure are explicit numeric
context lanes; no hidden
text/probability lane participates in rule selection. Stored exception masks,
not context flags alone, decide whether emergency or confirmed identity bypasses
a rule.

## WM-0065 M4 borrowed-shadow crisis metrics

`M4BorrowedShadowCrisisStore.createMetrics()` records borrowed-shadow owner
version, active activation candidate count, active/resolved/failed crisis
counts, low-risk evidence count, trace ring usage, next trace sequence, and the
last/total activation candidate visits. Normal crisis activation reads do not
walk lamp, evidence, obligation, resident or map stores. They consume explicit
activation basis rows produced by approved owner surfaces and walk only the
sorted candidate lane with caller `candidateCap` and `selectedCap` limits.

Crisis progress mutations are O(1) typed-array state transitions. Low-risk
evidence, escalation, non-combat resolution and failure write bounded trace-ring
rows with numeric reason codes; trace overflow overwrites the oldest trace row
without changing crisis owner authority.

## WM-0066 M4 director pressure/recovery metrics

`M4DirectorPressureStore.createMetrics()` records director owner version,
pressure sample count, active incident and recovery candidate counts, recovery
window count, active recovery window id, selection count, last/total candidate
visits, cooldown write count, trace ring usage and next trace sequence.

Normal director selection never scans source lamp, evidence, obligation,
health, relationship, crisis, resident or map owner stores. Source systems feed
aggregate numeric samples with owner-version basis fields. Selection walks only
the active incident candidate lane or, inside a recovery window, the recovery
lane for that exact recovery type with caller candidate and selected caps.
Wrong-type recovery candidates are in different lanes and cannot consume the
active window's cap. Cooldowns are direct-indexed by cooldown key, and selected
Top-K rows are resolved through a named deterministic random stream. Recovery
opportunities are descriptors only; they do not mutate source owner facts.

## WM-0070 M4 benchmark note

`pnpm bench` now includes `m4-core-vertical-slice-long-run` in the default
benchmark suite. The benchmark runs
`m4.core_vertical_slice.borrowed_shadow_lamps.v1` with requested seed `4` and
authoritative seed `50` to `100000` ticks, samples `12000`, `36000`, `60000`,
`80000` and `100000`, verifies focused save/resume parity, and records Worker
projection byte sizes from the read-only projection path.

The M4 baseline records lamp dirty backlog peak/final counts, active lamp-gap
count, evidence support visits, confirmed rules, dissemination backlog,
obligation due/violation counts, town-rule candidate visits, crisis transition
counts, director candidate/recovery-window counts, ReasonTrace capacity/use,
save/load rebuilt surface count, Worker projection bytes and final hashes.
The artifact is written under
`coordination/artifacts/WM-0070/benchmarks/benchmark-results.json`. The
actual JSON file SHA-256 is recorded in
`coordination/artifacts/WM-0070/benchmarks/benchmark-results.json.sha256` as
`FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`; the JSON
also records canonical payload SHA-256
`B406B940AA8C55531DD9A8A47EEF4C248C1761E471B1D5B2D611491256370293` for the
pre-hashing metadata payload.
The benchmark baseline update preserves the existing 10 percent warning and
20 percent blocking regression thresholds.
