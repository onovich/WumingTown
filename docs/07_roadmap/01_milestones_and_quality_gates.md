# 里程碑质量门禁

## 每阶段通用门禁

- 功能演示不是视频假象，必须运行权威模拟。
- 相关存档 round-trip。
- Headless 场景和不变量通过。
- UI 有原因解释与开发覆盖层。
- 性能指标基线已记录。
- 文档、Schema、ADR 与任务状态同步。
- 独立 reviewer 通过。

## M0 closeout 状态

- Web shell、Electron shell、Worker protocol、Headless runner、Entity/Store、RNG/World Hash、内容 Schema/Compiler、CI/Benchmark/Audit 已通过独立任务评审后集成。
- Web shell 和 Electron shell 仍是工程壳：它们证明渲染、HUD、检查器、平台端口、打包与 smoke 路径，不代表已经完成 gameplay。
- Worker protocol 的 M0 Snapshot、UI Delta、Metrics、Save response 仍是协议占位或空世界输出；真实地图、角色、Job、Reservation、Pathing、存档容器和玩法命令属于 M1/M2 后续任务。
- Headless runner 当前证明固定 30 TPS、显式 seed、可重放 summary/hash、百万空 Tick 和基础结构命令；它不是完整镇模拟。
- 内容管线当前覆盖 JSON5 fixture、Def ID、引用、本地化、Patch 冲突和稳定编译顺序；首批生产内容、文化审查和规则组件化仍在后续内容阶段。
- 当前显式 benchmark baseline 位于 `packages/benchmarks/baseline.json`，`pnpm bench` 会写出 artifact 并按 10% 警告、20% 阻断阈值比较。
- M0 关闭后，任何第一条 gameplay simulation work 必须以 WM-0012 产出的 M1 任务 DAG 为前置，不得把上述占位声明为已完成玩法。

## 杀项目/转向信号

- M2 后 TypeScript 正常规模仍无法达到 30 TPS，且复杂度/索引优化无效；进入 Wasm Spike。
- M4 玩家反复认为规则死亡不可推断；重新设计证据玩法，而非继续加异类。
- M5 内容每项都需要专用代码；暂停内容生产，重构规则组件。
- Web 门禁连续两轮失败；降级平台，不让 Web 拖累 Windows。

## M1 Closeout Status

WM-0030 closes M1 as a simulation-kernel milestone, not as a product-content
milestone. The reviewed M1 task chain establishes deterministic Entity/Store
ownership, map/chunk/region/pathing primitives, reservations, indexed work
offers, serializable job drivers, the minimal hauling/building scenario,
save/replay coverage, Worker/headless parity, and benchmark-backed long-run
invariants.

Closeout evidence:

- Headless hauling/building: `pnpm sim:run -- --seed 1 --scenario hauling-building --ticks 100000` passed with final world hash `0xf7815189` and `longRunStable=true`.
- Worker parity: `pnpm test:e2e --filter worker-smoke` passed, including Node/Worker M1 authoritative-hash parity.
- Save/replay: `pnpm ci:local` ran the replay diagnostics and M1 save/resume checks; the M1 final world/read-model hashes were `0xf7815189` and `0x53fe1af9`.
- 50000-entity pressure: `pnpm bench` passed the spatial-index benchmark with `finalBacklogCount=0`, `finalMapMemberships=49488`, and `finalIndexedEntities=49488`.
- Benchmark threshold policy remains 10 percent warning and 20 percent blocking regression.

Residuals that are deliberately not M1 scope: broad town-life simulation,
economy/content expansion, public save compatibility beyond the M1 envelope,
platform save UI, and longer product-scale memory soaks beyond the current
benchmark pressure gates. Existing nonblocking warnings remain tracked: Node
`DEP0190` warnings from local scripts and Vite chunk-size warnings during web
and desktop builds.

## M2 Closeout Status

WM-0043 closes M2 as a work/logistics vertical-slice milestone. The reviewed
M2 task chain establishes the executable M2 scenario contract, ADR-0007
ownership boundaries, Region/A\* work selection, multi-pawn WorkOffer scoring,
reservation contention cleanup, storage hauling beyond the M1 fixture,
build-order/production-order scaffolding, M2 save/replay resume, Worker/headless
parity, and benchmark-backed long-run invariants.

Closeout evidence:

- Headless work/logistics: `pnpm sim:run -- --seed 2 --scenario m2-work-logistics --ticks 100000` passed with final world hash `0x9e689c8d`, 20 actors used, 4 completed build orders, 24 delivered wood, 12 delivered stone and zero active reservations/offers/jobs.
- Save/replay: focused M2 replay diagnostics passed with save tick `6000`, save size `5522` bytes, rebuilt indexes `work-offers`, `path-caches`, `reservations`, `read-models`, and no first divergent tick; the 20000-tick replay hashes were world `0x9182c40d` and read model `0x7342625f`.
- Worker parity: WM-0041 verified Node Worker and browser Worker coverage for the same M2 command stream without granting UI authority.
- Benchmarks: `pnpm bench` passed with latest closeout rerun medians of `4.053ms` for M2 path invalidation and `2.451ms` for M2 long-run; final hash `0x9e689c8d`, 100 processed path requests, 20 stale rejects, final queue backlog 0 and reviewed artifact SHA-256 `7AAD7C5CA023F018A2B00F0F205C784EDCF2CACCA139C11C84A519A93891C8AC`.
- Benchmark threshold policy remains 10 percent warning and 20 percent blocking regression.

Residuals that are deliberately not M2 scope: broad economy, town-life needs,
health, mood, relationships, day/night/weather, anomaly/combat/crisis chains,
M4 lamp/social gameplay, platform save UI, public save compatibility beyond
focused harnesses, content catalog expansion and balance production. Existing
nonblocking warnings remain tracked: Node `DEP0190` warnings from local scripts
and Vite chunk-size warnings during web and desktop builds.

## M3 Closeout Status

WM-0060 closes M3 as an ordinary-life simulation milestone. The reviewed M3
task chain establishes the executable scenario contract, ADR-0008 owner-store
architecture, needs and urgency indexes, day/night and weather basics, rest and
sleep jobs, food/eating logistics, health conditions, ability cache
invalidation, medical treatment jobs, mood/thought/memory lanes, relationship
events, integrated ordinary-life scenario composition, focused save/replay,
Worker/headless parity, and benchmark-backed long-run invariants.

Closeout evidence:

- Headless ordinary life:
  `pnpm sim:run -- --seed 3 --scenario m3-ordinary-life --ticks 100000` passed
  with scenario id `m3.ordinary_life.injured_caregiver.v1`, requested seed `3`,
  authoritative scenario seed `46`, command hash `0x226832d2`, content hash
  `0xdfe7107e`, final world hash `0x7eb81a69`, replay hash match `true`, zero
  terminal reservations/jobs, zero negative need lanes, zero stale medical
  offer rejects, zero stale ability cache rejects, zero active M4 facts and
  zero conservation drift.
- Save/replay: WM-0057 verified save tick `12000`, load tick `12001`, resumed
  final world hash `0x9b04b712`, final read-model hash `0x0f12213c`, loaded
  state hash `0x0dbf661c`, save bytes `4941`, rebuilt derived surfaces and
  `firstDivergentTick: null` in
  `coordination/artifacts/WM-0057/m3-save-replay/summary.json`.
- Worker parity: WM-0058 verified Node Worker and real browser module Worker
  coverage for M3 checkpoints `0`, `3600`, `7200`, `12000`, `18000` and
  `36000`, with read-only projection payloads and no Worker protocol redesign.
- Benchmarks: WM-0059 verified `m3-ordinary-life-long-run` with long-run final
  world hash `0x7eb81a69`, final read-model hash `0x82bf87d6`, Worker
  projection bytes `1747`, exact stable condition/mood/relationship invariants,
  no stale offers, no queue growth and no hash divergence. The reviewed
  artifact is
  `coordination/artifacts/WM-0059/benchmarks/benchmark-results.json` with
  SHA-256 `63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`.
- Benchmark threshold policy remains 10 percent warning and 20 percent blocking
  regression. The final integration `pnpm bench` pass had a non-blocking
  `map-dirty` warning and no M3 invariant mismatch.

Residuals that are deliberately not M3 scope: M4 lamp network, Chronicle
evidence gameplay, obligations, anomaly/crisis chains, story director systems,
product dawn replay, broad economy, content catalog expansion, public save
compatibility beyond focused harnesses, platform save UI, and UI authority.
WM-0060 creates no M4 task and implements no M4 runtime behavior.

## M4 Planning Status

WM-0061 starts M4 planning only. The planning package adds the M4 scenario
contract, ADR-0009, roadmap plan, and proposed WM-0062 through WM-0071 packets.
Implementation remains blocked behind review/integration of WM-0061 and normal
taskctl promotion.

The M4 gate must preserve M0-M3 evidence, including the M3 final world hash
`0x7eb81a69`, final read-model hash `0x82bf87d6`, and reviewed benchmark
artifact SHA-256
`63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`.
The 10 percent warning and 20 percent blocking benchmark thresholds remain
unchanged.

M4 closeout must include a future M5 entry prompt, but no M5 task may be
created or implemented by M4 planning.
