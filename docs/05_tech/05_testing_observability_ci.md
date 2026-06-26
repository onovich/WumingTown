# 测试、可观测性与 CI

## 测试层

- 单元：纯算法、Store、规则和迁移。
- 系统：多个 Store + 固定 Tick。
- 场景：数据化世界、计划事件与断言。
- 属性/模糊：Reservation、容器、存档、规则图。
- 重放：命令流与周期 Hash。
- 浏览器：Worker、Canvas、React、输入、OPFS。
- Electron：Preload、文件存档、窗口与打包 smoke。
- 性能：固定机器/环境基准与趋势。

## CI 阶段

```text
format-check → lint → typecheck → unit → scenario → replay
→ content-validate → web-build → browser-smoke
→ desktop-smoke → benchmark-sanity → docs-links
```

PR 可按变更路径跳过不相关昂贵步骤，但主分支每日跑全套。

当前本地复现实入口为 `pnpm ci:local`、`pnpm bench` 与 `pnpm audit:deps`。CI 必须直接调用这些脚本，而不是维护一套只在云端存在的隐式命令序列。

每个 CI job 都要记录精确的 Node、pnpm、npm、OS、CPU 与 Git commit 信息，并把 JSON artifact 连同 benchmark、determinism 与 audit 结果一起上传，便于比较不同 PR 的真实运行环境。

## 错误处理

模拟不允许吞异常继续。开发构建暂停并导出诊断；发布构建生成安全错误包，保留最近命令与 Hash，不上传私人数据除非用户同意。

Determinism / long-run 诊断失败必须输出 seed、首个分歧 tick 和 artifact 路径。禁止只打印“重放失败”之类不可复现的摘要。

## 指标

Tick 系统耗时、队列、候选、路径节点、快照大小、消息延迟、内容加载、存档大小与迁移耗时。指标 ID 稳定，报告可机器比较。

测试框架与工作流不得静默重试 nondeterministic product 行为。允许等待 ready 条件的显式轮询，但禁止配置非零 `retry` / `retries` / `repeatEach` 来掩盖不稳定结果。

## WM-0028 implementation note

`pnpm test --filter m1-save-replay` covers the focused M1 save/load/resume
harness and divergence diagnostics. `pnpm test:e2e --filter worker-smoke` now
also compares Worker and Node headless M1 checkpoint hashes.

`pnpm sim:replay-test` preserves the existing deterministic replay probe and
adds M1 hauling-building artifacts under
`coordination/artifacts/WM-0010/m1-save-replay/`. The structured output names
the seed, scenario id, first divergent tick and artifact paths when a divergence
is detected.

## WM-0029 implementation note

`pnpm test --filter m1-invariants` is the focused M1 long-run invariant gate for
the hauling/building scenario. It runs seed `1` to 100000 ticks, checks replay
and save-resume consistency, and fails on reservation leaks, stale work offers,
negative resource counts, queue growth and hash divergence. The long-run
harness explicitly samples the idle window from tick `2401` through `100000`
and records repeated queue, job, reservation and offer metrics in the
scenario-backed benchmark artifact.

`pnpm bench` writes the WM-0029 artifact to
`coordination/artifacts/WM-0029/benchmarks/benchmark-results.json`. The artifact
records `nodeVersion`, `pnpmVersion`, `osRelease`, `platform`, `arch`,
`cpuModel`, `cpuCount` and `gitCommit` so benchmark comparisons can name the
actual runtime. The documented pnpm forwarding form
`pnpm sim:run -- --seed 1 --scenario hauling-building --ticks 100000` is a
supported local reproduction command.

## WM-0040 implementation note

`pnpm test --filter m2-save-replay` covers the focused M2 work/logistics
save/load/resume harness. It validates save shape, versions, scenario id, owner
handles, integer lanes, sorted records, rebuilt derived indexes and structured
divergence diagnostics for `m2.work_logistics.lantern_yard.v1`.

`pnpm sim:replay-test -- --scenario m2-work-logistics` runs the M2 replay gate
with seed `2`, save tick `6000` and final tick `20000`. It writes expected,
actual, save, resumed and summary artifacts under
`coordination/artifacts/WM-0040/m2-save-replay/`, and prints the scenario id,
seed, first divergent tick and artifact paths on failure.

## WM-0041 implementation note

`pnpm test --filter m2-worker-parity` covers the Node Worker harness for the M2
work/logistics scenario. It compares Worker render snapshots, UI deltas and
metrics against `runM2WorkLogisticsReplay` checkpoints for seed `2` at ticks
`0`, `6000` and `20000`, and records deterministic diagnostics including seed,
scenario id, first mismatched checkpoint tick, final snapshot size and Worker
message latency count.

`pnpm test:e2e --filter worker-smoke` now keeps the existing M1 browser Worker
coverage and also runs the M2 command stream through a real browser module
Worker. The Worker still emits read-only projections over the existing protocol
message kinds; no UI, web shell or Electron layer becomes authoritative.

## WM-0042 implementation note

`pnpm test --filter m2-invariants` is the focused M2 long-run invariant gate for
the work/logistics scenario. It runs seed `2` to `100000` ticks, samples the
terminal window at `20000`, `40000`, `60000`, `80000` and `100000`, and fails on
reservation leaks, uncleared offers, running jobs, negative resources, material
loss, queue growth or save/resume hash divergence.

`pnpm bench` writes the WM-0042 artifact to
`coordination/artifacts/WM-0042/benchmarks/benchmark-results.json`. The artifact
records `nodeVersion`, `pnpmVersion`, `osRelease`, `platform`, `arch`,
`cpuModel`, `cpuCount` and `gitCommit`, and includes the M2 scenario id, seed,
tick horizon, final world hash `0x9e689c8d`, final read-model hash
`0x2d2933dc`, 100-path stale reject count, node expansions, queue backlog and
path checksum evidence.

The documented M2 headless reproduction command is
`pnpm sim:run -- --seed 2 --scenario m2-work-logistics --ticks 100000`. The
command prints the authoritative M2 scenario summary from the Node headless
runner; UI and Electron remain read-only consumers.

## WM-0057 implementation note

`pnpm test --filter m3-save-replay` covers the focused M3 ordinary-life
save/load/resume harness. It validates the 12000 save tick, 12001 load tick,
36000 final horizon, versions, scenario id, owner handles, integer lanes,
sorted records, section validation, rebuilt derived surfaces, and structured
divergence diagnostics.

`pnpm sim:replay-test -- --scenario m3-ordinary-life` runs the M3 replay gate
with requested seed `3` and authoritative scenario seed `46`. It writes
expected, actual, save, resumed, and summary artifacts under
`coordination/artifacts/WM-0057/m3-save-replay/`, including checkpoint hashes,
save byte size, rebuilt surface hashes, and `firstDivergentTick` on failure.

## WM-0058 implementation note

`pnpm test --filter m3-worker-parity` covers the focused M3 Worker/headless
parity gate. It runs the same M3 ordinary-life checkpoint command stream
through the Node Worker harness and compares all six contract checkpoints
against `runM3OrdinaryLifeReplay`, including authoritative world hashes,
read-model hashes, read-only snapshot/UI surfaces, M3 save metadata, snapshot
byte size, read-model byte size, first mismatch tick, and projection-message
latency counts.

`pnpm test:e2e --filter worker-smoke` keeps the existing M1 and M2 browser
Worker smoke coverage and now also runs
`m3.ordinary_life.injured_caregiver.v1` through a real browser module Worker.
The Worker still uses the existing protocol message kinds; no UI, Electron,
platform save, or read-model consumer becomes authoritative.

## WM-0059 implementation note

`pnpm test --filter m3-invariants` is the focused M3 long-run invariant gate for
the ordinary-life scenario. It runs requested seed `3` through terminal samples
up to `100000` ticks, compares uninterrupted replay against the long-run world
hash, verifies save/resume parity from tick `12000` to `36000`, and asserts no
reservation leak, stale medical request, stale medical offer basis reject,
running job leak, negative needs/resources, stale ability cache reject, exact
condition drift, exact mood/relationship drift, queue growth, M4 fact,
conservation drift, or hash divergence.

`pnpm bench` writes the WM-0059 artifact to
`coordination/artifacts/WM-0059/benchmarks/benchmark-results.json`. The artifact
includes the environment block (`nodeVersion`, `pnpmVersion`, `osRelease`,
`platform`, `arch`, `cpuModel`, `cpuCount`, `gitCommit`), the full
`m3-ordinary-life-long-run` report, checkpoint hashes through tick `100000`,
final summary, save/load rebuild timing, Worker snapshot/read-model/projection
byte counts, final world hash `0x7eb81a69`, final read-model hash
`0x82bf87d6`, stale medical offer reject count, exact stable condition,
mood and relationship values, and the 10 percent warning / 20 percent blocking
baseline comparison.

The documented M3 headless reproduction command is
`pnpm sim:run -- --seed 3 --scenario m3-ordinary-life --ticks 100000`. The
command prints the authoritative M3 scenario summary from the Node headless
runner; UI, Worker projection consumers and Electron remain read-only.

## WM-0068 implementation note

`pnpm test --filter m4-save-replay` covers the focused M4 core vertical slice
save/load/resume harness. It validates the `12000` save tick, `12001` load
tick, `36000` final horizon, scenario id, requested and authoritative seeds,
versions, sorted owner rows, integer lanes, crisis/director rows, command tail,
projection hashes, rebuilt surfaces and structured first-divergent-tick
diagnostics.

`pnpm sim:replay-test -- --scenario m4-core-vertical-slice` runs the M4 replay
gate with requested seed `4` and authoritative scenario seed `50`. It writes
expected, actual, save, resumed and summary artifacts under
`coordination/artifacts/WM-0068/m4-save-replay/`, including save byte size,
load validation time, rebuild time, rebuilt surface names/hashes, command tail
and checkpoint hashes.

## WM-0069 implementation note

`pnpm test --filter m4-worker-parity` covers the focused M4 Worker/headless
parity gate. It runs the M4 core vertical slice command stream through the Node
Worker harness and compares all six checkpoint ticks against
`runM4CoreVerticalSliceReplay`, including authoritative world hashes,
read-model hashes, read-only basis summaries, snapshot byte size, read-model
byte size, projection byte size, first mismatch tick and Worker message latency
counts.

`pnpm test:e2e --filter worker-smoke` keeps existing M1, M2 and M3 browser
Worker smoke coverage and now also runs
`m4.core_vertical_slice.borrowed_shadow_lamps.v1` through a real browser module
Worker. The Worker still uses the existing protocol message kinds; no UI,
Electron, platform save, public protocol redesign or client repair surface
becomes authoritative.

## WM-0070 implementation note

`pnpm test --filter m4-invariants` is the focused M4 long-run invariant gate.
It runs the core vertical slice with requested seed `4` through samples at
`12000`, `36000`, `60000`, `80000` and `100000`, checks the post-`36000` idle
window for lamp dirty backlog growth, evidence drift, dissemination backlog
growth and obligation leaks, and reuses the M4 Worker parity test to catch
Worker projection mismatch.

`pnpm bench` writes the WM-0070 artifact to
`coordination/artifacts/WM-0070/benchmarks/benchmark-results.json`. The artifact
includes the environment block (`nodeVersion`, `pnpmVersion`, `osRelease`,
`platform`, `arch`, `cpuModel`, `cpuCount`, `gitCommit`), scenario id, seed,
tick horizon, checkpoint hashes through `100000`, final summary, M4 metric
block, save/load rebuilt surface count, Worker projection bytes, final world
hash `0xdafa3b25`, final read-model hash `0x08dd9343`, actual JSON file
SHA-256 sidecar
`coordination/artifacts/WM-0070/benchmarks/benchmark-results.json.sha256`
with hash `FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`,
and canonical payload SHA-256
`B406B940AA8C55531DD9A8A47EEF4C248C1761E471B1D5B2D611491256370293` inside
the JSON artifact.

The documented M4 headless reproduction command is
`pnpm sim:run -- --seed 4 --scenario m4-core-vertical-slice --ticks 100000`.
The command prints the authoritative M4 scenario summary from the Node headless
runner; UI, Worker projection consumers and Electron remain read-only.
