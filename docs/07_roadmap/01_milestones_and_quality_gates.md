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

## M4 Closeout Status

WM-0071 closes M4 as a core vertical-slice milestone after reviewed integration
of WM-0062 through WM-0070. The reviewed task chain establishes authoritative
lamp-network rule fields, Chronicle evidence and dissemination, obligations,
town-rule compliance, borrowed-shadow crisis state, director recovery windows,
the integrated M4 scenario, focused save/replay, Worker/headless parity, and
benchmark-backed long-run invariants.

Closeout evidence:

- Headless M4 core scenario:
  `pnpm sim:run -- --seed 4 --scenario m4-core-vertical-slice --ticks 100000`
  passed with scenario id `m4.core_vertical_slice.borrowed_shadow_lamps.v1`,
  requested seed `4`, authoritative scenario seed `50`, command stream hash
  `0x538d0e43`, content hash `0x698f2c41`, final world hash `0xdafa3b25` and
  scenario read-model hash `0xa896439d`.
- Rule-discovery gate: prevention, containment and failure use branch-specific
  owner fixtures; Chronicle identity evidence, lamp obligation fulfillment,
  town-rule compliance, low-risk evidence and dawn-review rows are structured
  owner-derived facts.
- Save/replay: WM-0068 verified focused save tick `12000`, load tick `12001`,
  save bytes `8124`, rebuilt M4 derived surfaces and
  `firstDivergentTick: null`.
- Worker parity: WM-0069 verified Node Worker and real browser module Worker
  coverage for M4 checkpoints with read-only projections and
  `firstMismatchedCheckpointTick: null`.
- Benchmarks: WM-0070 verified `m4-core-vertical-slice-long-run` in the default
  benchmark suite, with artifact
  `coordination/artifacts/WM-0070/benchmarks/benchmark-results.json`, actual
  file SHA-256
  `FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`, and no
  threshold weakening.
- M0-M3 regression status remains protected, including M3 final world hash
  `0x7eb81a69`, final benchmark read-model hash `0x82bf87d6`, and zero active
  M4 facts in the M3 baseline evidence lane.

Residuals that are deliberately not M4 scope: M5 alpha content framework,
multiple anomaly roster, faction campaign, broad governance simulation, season
event pool, production content catalog, data-mod pipeline expansion, platform
save UI, public save compatibility, public Worker protocol redesign and UI
authority. WM-0071 creates no M5 task and implements no M5 runtime behavior.

## M5 Planning Status

WM-0072 starts M5 planning only. The planning package adds the M5 scenario
contract, ADR-0010, roadmap plan, and proposed WM-0073 through WM-0083 packets.
Implementation remains blocked behind review/integration of WM-0072 and normal
taskctl promotion.

The M5 gate must preserve M0-M4 evidence, including M4 final world hash
`0xdafa3b25`, M4 scenario read-model hash `0xa896439d`, M4 benchmark final
world/read-model hashes `0xdafa3b25` / `0x08dd9343`, and reviewed M4 benchmark
artifact SHA-256
`FDC0DFE779264134C23F3DAF95C92C879C683DDCBB22A9E704F12359B3DC0E71`.
The 10 percent warning and 20 percent blocking benchmark thresholds remain
unchanged.

M5 closeout must report M6 readiness stop signs, but no M6 task may be created
or implemented by M5 planning.

## M5 Closeout Status

WM-0083 closes M5 as the alpha content framework milestone after reviewed
integration of WM-0073 through WM-0082. The reviewed task chain establishes
schema-validated alpha content, anomaly roster data, third-knock and old-bridge
rules, faction/governance owner stores, first-season event pool, integrated M5
headless scenario, focused save/replay, Worker/headless parity and
benchmark-backed long-run invariants.

Closeout evidence:

- Headless M5 alpha content framework:
  `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
  passed with scenario id `m5.alpha_content_framework.first_season.v1`,
  requested seed `5`, authoritative seed `155`, command stream hash
  `0x81d37435`, content manifest hash `0xe55d3015`, final world hash
  `0xfba70a5c` and scenario read-model hash `0x9ba83cb7`.
- Content and anomaly gates: the M5 baseline records 30 content definitions,
  20 catalog entries, one fail-closed validation/block reason, three anomaly
  definitions, three anomaly activation candidate visits, 16 anomaly
  transition trace rows, and one resolved third-knock plus one resolved
  old-bridge case with no active crisis leaks.
- Faction/governance and season gates: bounded faction candidate visits `4`,
  governance candidate visits `8`, selected faction facts `2`, selected
  governance hooks `4`, event pool candidates `7`, cooldown writes `1` and
  precondition failures `5`.
- Save/replay and Worker parity: WM-0083 verifies focused save tick `12000`,
  load tick `12001`, checkpoint hashes through `100000`, no divergent replay
  tick through the comparison helper, Worker projection bytes `1631`, Worker
  projection hash `0xc6420cb1`, and Worker authoritative read-model hash
  `0x57eba2b7` at the reviewed `36000` checkpoint.
- Benchmarks: `pnpm bench` passed the default benchmark suite with artifact
  `coordination/artifacts/WM-0083/benchmarks/benchmark-results.json`, actual
  file SHA-256
  `04DB70ECD54022C298293BE9B00EDF404AC18122742F3ACB0C17AC21EE58D346`,
  canonical payload SHA-256
  `4815D8AC685CC51AC53260C14C302E1C508584AF81EA261664283711A00F0BAC`, and no
  threshold weakening.
- M0-M4 regression status remains protected, including M4 seed `4`,
  authoritative seed `50`, content hash `0x698f2c41`, command stream hash
  `0x538d0e43`, final world hash `0xc201a925`, and read-model hash
  `0xce261d9d` in the M5 scenario's regression evidence lane.

M6 readiness is deliberately not M6 planning. WM-0083 records
`m6StopSignVerdict: "stop_signs_only"` and `m6Created: false`; no M6 task is
created, promoted, claimed, implemented or reviewed during M5 closeout.

## M6 Product-Gate Consolidation Status

WM-0095 consolidates M6 evidence for the Web / Windows Product Gate after the
Web build, Web performance, storage fallback, SAB fallback, Windows package,
preload security, input/accessibility, diagnostics and external smoke tasks.

Current consolidation evidence:

- `coordination/artifacts/WM-0095/m6-product-gate-consolidation.json` records
  the machine-readable evidence matrix and SHA-256 sidecar.
- M5 final world/read-model hashes remain protected at `0xfba70a5c` /
  `0x9ba83cb7`.
- `pnpm bench` under the WM-0095 artifact root passed all `15` comparisons with
  zero warnings and zero failures.
- Chrome Stable and Edge Stable Web shell measurements are present, but Web
  same-spec remains unproven because the current browser path is not a measured
  30 TPS / 20k-entity authority runtime.
- Windows has an unsigned local external-test directory build with preserved
  Electron security boundaries.
- Web save/export/import and local diagnostics are covered by WM-0094 smoke;
  Windows host diagnostics writing and Windows/Web save-container
  interoperability remain explicit product-gate blockers until reviewed bridges
  exist.

WM-0095 does not start M7, create a public release, upload artifacts, add
signing credentials, add telemetry, weaken thresholds or rewrite verified M5
benchmark artifacts.

## M6 Closeout Status

WM-0097 closes M6 as the Web / Windows Product Gate after the reviewed task
chain WM-0085 through WM-0096 records the build, Web performance, storage,
SharedArrayBuffer fallback, Windows package, Electron security, input,
diagnostics, smoke, benchmark and product decision evidence.

Closeout evidence:

- Web tier verdict: `demo-only`. Web remains a gated target, but same-spec,
  lower-fast-forward and lower-cap claims remain unproven until a future
  reviewed task measures a real product-scale browser authority runtime.
- Windows external-test verdict: `ready-for-controlled-external-test` as an
  unsigned unpacked local directory build, not installer/signing/updater/store
  or public release readiness.
- M5 alpha content framework regression remains protected at final
  world/read-model hashes `0xfba70a5c` / `0x9ba83cb7`.
- WM-0095 benchmark evidence records 15 comparisons, zero warnings, zero
  failures and unchanged 10 percent warning / 20 percent blocking thresholds.
- Chrome Stable and Edge Stable Web shell evidence records shell-ready
  `480 ms` / `456 ms`, interaction P95 `17.1 ms` / `17.4 ms`, frame P95
  `18.3 ms` / `18.3 ms`, JS heap delta `0.684 MB` / `0.691 MB`, and runtime
  estimated gzip bytes `273561`.
- Windows package evidence records `376084065` bytes, `91` files and digest
  `79e7f734fc6741f09070921dcdbc992db3b612619537271faae2774dc4cbeb60`.
- Web OPFS save/export/import, local diagnostic download, input baseline and
  SharedArrayBuffer-unavailable fallback are covered. Windows/Web
  save-container interoperability and Windows host-side diagnostic package
  writing remain blockers until reviewed narrow desktop bridges exist.

WM-0097 does not start M7, create M7 task packets, produce store/public release
materials, add privacy commitments, add telemetry, sign/upload artifacts or
make public save compatibility commitments. Future M7 starts only from an
owner-sent goal and reviewed M7 task DAG.

## M7 Planning Status

WM-0098 starts M7 planning after the owner sent the M7 goal and the startup
audit confirmed WM-0097 is done, independently reviewed, integrated and pushed.
The WM-0098 package creates proposed WM-0099 through WM-0110 task packets for
Early Access / public playtest preparation. These packets remain proposed until
WM-0098 is independently reviewed, integrated and marked done, after which
normal taskctl dependency promotion may unlock eligible M7 work.

The M7 planning gate must preserve M0-M6 regression evidence, including the M5
alpha content framework final world/read-model hashes `0xfba70a5c` /
`0x9ba83cb7`, the unchanged 10 percent warning / 20 percent blocking benchmark
threshold policy, the M6 Web `demo-only` verdict and the M6 Windows unsigned
controlled-external-test verdict.

M7 planning is not public release approval, Early Access launch approval,
store submission, public Web launch, signing, installer/updater distribution,
telemetry, accounts, hosted services, paid services, public feedback systems,
final privacy/legal/store claims, public save compatibility commitment or M8
startup.

## M7 Closeout Status

WM-0110 closes M7 as Early Access / public playtest preparation after the
reviewed task chain WM-0098 through WM-0109 records planning, onboarding,
balance/readability, cultural review, privacy/feedback/diagnostics, Windows
controlled-test instructions, Web demo-only scope, save compatibility policy,
store/public-playtest material draft, known issues, tester protocol and the M7
readiness matrix.

Closeout evidence:

- WM-0098 through WM-0109 are `done`, independently reviewed as `verified` and
  integrated before WM-0110 closeout.
- Early Access preparation is ready for owner review but not launch-approved.
- Public playtest preparation is ready as controlled-test/public-playtest
  evaluation material but not public-recruitment-approved.
- Web demo readiness is limited to demo-only evaluation; same-spec,
  lower-fast-forward, lower-cap and public Web launch remain unproven or
  owner-gated.
- Windows controlled external test readiness is limited to the unsigned
  unpacked local directory build; signing, installer, updater, store package
  and public Windows release remain owner-gated.
- Local/manual privacy, feedback and diagnostics support is documented; no
  telemetry, upload, account, hosted feedback, crash upload or paid-service
  path is approved.
- Save compatibility remains a controlled-test draft. Public compatibility,
  cross-version migration guarantees and Windows/Web save interoperability
  remain owner-gated.
- The M5 alpha content framework final world/read-model hashes remain
  `0xfba70a5c` / `0x9ba83cb7`; benchmark warning/blocking thresholds remain
  10 percent and 20 percent.

WM-0110 does not start M8. It writes only the non-executable future M8 prompt
at `coordination/reports/WM-0110-future-m8-entry-prompt.md`; a later
owner-sent M8 goal and reviewed M8 task DAG are required before any M8
implementation task can be claimed.

## M8 UI / I18n Planning Gate

WM-0111 incorporates
`OWNER-AMENDMENT-2026-06-27-UI-I18N-PRODUCTIZATION` into the M8 task DAG before
implementation begins.

M8 closeout must prove:

- Product UI Gate: the default experience is a player-facing game interface,
  not a diagnostics harness.
- Responsive Layout Gate: at least `1280x720`, `1366x768`, `1424x861`,
  `1600x900`, `1920x1080`, `2560x1369` and `2560x1440` are validated.
- Localization Gate: `zh-CN` and `en` are supported, locale defaults and
  manual override work, player-visible strings use localization keys and
  missing translations fail tests.
- Visual Identity Gate: Wuming Town theme tokens and HUD language carry
  lantern, Chronicle, ordinance, resident, explanation and night-risk cues.
- First Playability Gate: the default flow explains the current phase, possible
  actions, next goal and game-versus-diagnostics boundary.
- Accessibility Gate: text readability, non-color-only state, UI scale,
  keyboard/mouse basics, contrast, long-text containment, scroll usability and
  bilingual layout behavior are covered.

These gates are mandatory M8 productization requirements, not optional polish.
They do not approve public release, 1.0 release, store submission, public Web
launch, signing, telemetry, accounts, paid services, final public claims or
public save compatibility.

## M8 Readiness Matrix Status

WM-0126 consolidates the reviewed M8 evidence into an internal 1.0 readiness
matrix after WM-0112 through WM-0125 are done, independently reviewed and
integrated.

Current consolidation evidence:

- `docs/07_roadmap/11_m8_1_0_readiness_matrix.md` records the gate-by-gate M8
  readiness decision and repeats the owner-gated residuals.
- Product UI, visual identity, responsive layout, first-play and accessibility
  evidence are consolidated from WM-0112 through WM-0120.
- Content/endgame scope, anomaly roster targets, faction/endgame owner slice,
  data-mod/localization workflow and focused long-save evidence are
  consolidated from WM-0121 through WM-0125.
- M0-M7 regression protection remains anchored to the M5 alpha content
  framework final world/read-model hashes `0xfba70a5c` / `0x9ba83cb7`, the
  Web `demo-only` verdict, the Windows unsigned
  `ready-for-controlled-external-test` verdict, and the unchanged 10 percent
  warning / 20 percent blocking benchmark policy.
- WM-0126 reruns the required regression and performance gates before
  integration, including `quality`, `ci:local`, `m5-invariants`, `bench` and
  the 100000-tick M5 headless scenario.
- WM-0126 records the initial benchmark stop sign: `quality`, `ci:local`,
  `m5-invariants` and the 100000-tick M5 headless scenario passed, but repeated
  `bench` reruns exceeded the 20 percent blocking threshold in `entity-store`,
  `m4-core-vertical-slice-long-run`, `map-dirty` and `spatial-index`.
- WM-0128 clears that stop sign after independent review: two current-HEAD
  full `corepack pnpm bench` reruns and a reviewer rerun pass under the
  unchanged 10 percent warning / 20 percent blocking policy without changing
  benchmark baselines, thresholds or product code.

WM-0126 does not approve public release, public Web launch, Windows public
release, store submission, signing, telemetry, accounts, hosted services, paid
services or public save compatibility.

## M8 Closeout Status

WM-0127 closes M8 as internal 1.0 readiness evidence after reviewed integration
of WM-0111 through WM-0126 and WM-0128. Product UI, responsive layout,
zh-CN/en localization, visual identity, first-play guidance, accessibility,
content/endgame scope, anomaly roster, faction/endgame evidence, data-mod
workflow, focused long-save evidence and benchmark regression protection are
recorded in `docs/07_roadmap/11_m8_1_0_readiness_matrix.md`.

Closeout preserves the M5 alpha content framework final world/read-model hashes
`0xfba70a5c` / `0x9ba83cb7`, the Web `demo-only` verdict, the Windows unsigned
`ready-for-controlled-external-test` verdict and the unchanged 10 percent
warning / 20 percent blocking benchmark policy.

M8 closeout does not approve public release, public 1.0 launch, public Web
launch, Windows public release, store submission, signing, telemetry, accounts,
hosted services, paid services, final privacy/legal/store claims, public
feedback systems or public save compatibility.
