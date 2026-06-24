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
