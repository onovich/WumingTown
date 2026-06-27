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

## WM-0073 implementation note

`pnpm test --filter m5-content-validation` covers the focused M5 content gate.
It validates complete alpha packs, invalid schema and semantics, missing
localization, unsafe paths, unsupported capabilities, fail-closed archive/code
inputs, file-size limits and deterministic compiler output.

`pnpm content:validate` remains the M0-M4 fixture validation entry point, while
M5 pack validation is exposed through the content schema package, compiler and
`content-cli --m5-pack <dir>`. `pnpm quality` and local CI must keep the M5
filter registered in `tools/test-runner.mjs` so content-boundary regressions
are caught without starting runtime M5 behavior.

## WM-0081 implementation note

`pnpm test --filter m5-save-replay` covers the focused M5 save/load/resume
harness. It validates the `12000` save tick, `12001` load tick, `36000` final
horizon, scenario id, content manifest hash, owner handles, integer lanes,
anomaly/faction/governance/season rows, random stream positions, command tail,
projection hashes and structured divergence diagnostics.

`pnpm sim:replay-test -- --scenario m5-alpha-content-framework` runs the M5
replay gate with requested seed `5` and authoritative scenario seed `155`. It
writes expected, actual, save, resumed and summary artifacts under
`coordination/artifacts/WM-0081/m5-save-replay/`, including save byte size,
load validation time, rebuild time, rebuilt surface names/hashes, command tail
and checkpoint hashes.

## WM-0082 implementation note

`pnpm test --filter m5-worker-parity` covers the focused M5 Worker/headless
parity gate. It runs the Node Worker through the reviewed M5 checkpoint stream,
compares authoritative world and read-model hashes, records projection byte
size diagnostics under `coordination/artifacts/WM-0082/`, and verifies that M5
content, anomaly roster, faction/governance, season event, validation and
review basis hashes are exposed only as read-only Worker projection summaries.

`pnpm test:e2e --filter worker-smoke` now keeps the existing M1-M4 browser
Worker coverage and also runs `m5.alpha_content_framework.first_season.v1`
through a real browser module Worker. M5 stale projection basis checks use the
existing structured protocol reason codes and do not add a public Worker
message family, platform save UI, client repair path or authoritative UI state.

## WM-0083 implementation note

`pnpm test --filter m5-invariants` is the focused M5 long-run invariant gate.
It runs the alpha content framework with requested seed `5` through samples at
`12000`, `36000`, `60000`, `80000` and `100000`, verifies content validation
stability, anomaly leak absence, faction/governance bounded authority, season
event queue stability, focused save/resume hash parity, Worker projection
parity at the reviewed `36000` checkpoint and preserved M0-M4 regression
evidence.

`pnpm bench` writes the WM-0083 artifact to
`coordination/artifacts/WM-0083/benchmarks/benchmark-results.json`. The
artifact includes the environment block (`nodeVersion`, `pnpmVersion`,
`osRelease`, `platform`, `arch`, `cpuModel`, `cpuCount`, `gitCommit`),
scenario id, requested and authoritative seeds, content manifest hash
`0xe55d3015`, tick horizon `100000`, checkpoint hashes through `100000`, final
summary, save/load rebuilt surface count, save/load rebuild timing, Worker
projection bytes, final world hash `0xfba70a5c`, final read-model hash
`0x9ba83cb7`, actual JSON file SHA-256
`04DB70ECD54022C298293BE9B00EDF404AC18122742F3ACB0C17AC21EE58D346`, and
canonical payload SHA-256
`4815D8AC685CC51AC53260C14C302E1C508584AF81EA261664283711A00F0BAC`.

The documented M5 headless reproduction command is
`pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`.
M6 readiness remains a stop-sign report only: the artifact records
`m6StopSignVerdict: "stop_signs_only"` and `m6Created: false`; no M6 task is a
testing or CI prerequisite for M5 closeout.

## WM-0093 Local Diagnostic Package Gate

`packages/platform` now exposes the M6 local diagnostic package builder used by
the Web and Electron product-gate shells. The package records build task id,
runtime platform facts, scenario id, reviewed M5/M4 hashes, recent structured
renderer errors, safe logs and platform blockers.

Privacy and safety rules for the package:

- `telemetry=false` and `networkUpload=false`; diagnostics are local only.
- Local filesystem paths, credential-like values and full-save-like fields are
  redacted before serialization.
- Full save contents are not included. The package may include save slot count,
  status codes and checksums only.
- Web exports the package as a user-local browser download named
  `wuming-town-m6-diagnostics.json`.
- Windows Electron records `windows_host_diagnostics_bridge_blocked` until a
  reviewed narrow diagnostics bridge exists. WM-0093 does not add generic
  filesystem, dialog, shell, clipboard or arbitrary IPC access.

Focused validation:

- `pnpm test --filter diagnostics` runs the platform redaction/package tests.
- Web e2e downloads and inspects the local diagnostic package.
- Desktop Electron e2e verifies the sanitized diagnostics debug payload and the
  Windows host-package blocker in both dev and packaged launches.

## WM-0094 External Test Build Smoke

`pnpm test:e2e` is the consolidated M6 external-test smoke gate after the Web,
Windows package, preload, storage, input and diagnostics slices have landed.
The Web shell smoke launches the M5 product-gate fixture, covers browser
save/export/import, pointer and keyboard input, and downloads the local
diagnostic package. The Desktop Electron smoke launches both the dev main bundle
and the unpacked Windows directory build, verifies sandbox/preload boundaries,
checks the Windows diagnostics blocker and exercises the same M5 product-gate
surface.

Additional WM-0094 package checks:

- Before `pnpm build:desktop`, e2e seeds stale files in the Desktop main output
  and `dist/desktop/win-unpacked`.
- After packaging, e2e asserts those stale files are absent, proving the
  external-test artifact path starts from a clean output.
- The packaged smoke reads
  `apps/desktop-electron/dist/renderer/wm-release-gate-report.json` and asserts
  the `wm-0086-web-product-gate` harness, Chrome/Edge targets, renderer output
  path, bundle budget evidence, Simulation Worker/headless authority boundary
  and SharedArrayBuffer fallback assumption.
- This smoke remains an unsigned local external-test artifact. It does not
  upload public builds, use signing credentials, add telemetry or create a store
  release.

## WM-0095 M6 Product-Gate Consolidation

WM-0095 adds `tools/m6-product-gate-consolidation.mjs` as the machine-readable
M6 evidence aggregator. It reads the WM-0095 benchmark artifact, Web
release-gate report, Web performance-gate report, Windows package report and
WM-0094 smoke report, then writes:

- `coordination/artifacts/WM-0095/m6-product-gate-consolidation.json`
- `coordination/artifacts/WM-0095/m6-product-gate-consolidation.json.sha256`

The consolidation gate asserts:

- M5 long-run hashes remain `0xfba70a5c` / `0x9ba83cb7`.
- `pnpm bench` comparisons have no failures or invariant mismatches.
- Web build evidence is still the reviewed `wm-0086-web-product-gate` target.
- Chrome Stable and Edge Stable performance evidence is present.
- Windows Electron package evidence preserves `contextIsolation=true`,
  `nodeIntegration=false`, `sandbox=true` and
  `simulationAuthority=simulation-worker-or-headless`.
- Web save/export/import, diagnostics, input and Windows package launch evidence
  remains covered by WM-0094 `pnpm test:e2e`.

WM-0095 runs `pnpm bench` with
`WM_ARTIFACT_DIR=coordination/artifacts/WM-0095` so the benchmark entry point is
unchanged while reviewed WM-0083 artifacts are not rewritten. The task records
current Web/Windows evidence for product verdict input; it does not claim a Web
same-spec pass, start M7, upload a release, add signing, add telemetry or weaken
benchmark thresholds.

## WM-0102 M7 Privacy, Feedback And Diagnostics Readiness

WM-0102 records the M7 privacy, manual feedback and diagnostics readiness
boundary in `docs/05_tech/10_m7_privacy_feedback_diagnostics.md`.

The M7 boundary remains local and manual:

- Web diagnostic export is a user-initiated local download.
- Windows host-side diagnostic package writing remains blocked until a reviewed
  narrow diagnostics bridge exists.
- Windows/Web save-container interoperability remains blocked until a reviewed
  desktop save bridge exists.
- The diagnostic package must continue to report `telemetry=false` and
  `networkUpload=false`.
- Tester support collection is limited to manually provided reproduction notes,
  screenshots, local diagnostic JSON and coarse environment facts through an
  owner-approved controlled-test channel.

WM-0102 does not add telemetry, crash upload, accounts, hosted feedback,
network services, broad filesystem access, final privacy/legal claims, public
release, store submission or public save compatibility commitments.
